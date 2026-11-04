// A post's frontmatter (plan 32 Phase 4): the YAML block at the top of
// `website/content/writing/<slug>.mdx`, read at build time. Pure, so the Vite plugin, the post
// index and the tests share it.

/** What a post says about itself. */
export interface PostMeta {
  readonly title: string;
  /** The LCD row on the homepage phone's Writing list, where the title doesn't fit one. */
  readonly lcd: string | undefined;
  /** First published, `YYYY-MM-DD`. */
  readonly date: string;
  /** Last meaningfully changed, `YYYY-MM-DD`. */
  readonly updated: string | undefined;
  /** One or two sentences: the index, the meta description and the feed. */
  readonly summary: string;
  /** Left out of the index, the feed, the sitemap and the phone in production builds. */
  readonly draft: boolean;
}

/** The frontmatter block and the body after it; the block is empty without one. */
export function splitFrontmatter(source: string): { block: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (match === null) return { block: "", body: source };
  return { block: match[1]!, body: source.slice(match[0].length) };
}

const KEYS = ["title", "lcd", "date", "updated", "summary", "draft"] as const;
type Key = (typeof KEYS)[number];

/** A scalar: a double-quoted string (JSON escapes), a single-quoted one, or bare text. */
function scalar(raw: string): string {
  const value = raw.trim();
  if (value.startsWith('"')) return JSON.parse(value) as string;
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * The frontmatter `block` of `file` as typed fields: one `key: value` per line, keys from
 * `PostMeta`. Throws, naming the file and the field, on anything else.
 */
export function parseFrontmatter(block: string, file: string): PostMeta {
  const fields: Partial<Record<Key, string>> = {};
  for (const [i, line] of block.split(/\r?\n/).entries()) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const match = /^([a-z]+):(.*)$/.exec(line);
    if (match === null)
      throw new Error(`${file}: line ${i + 1} of the frontmatter isn't "key: value".`);
    const key = match[1] as Key;
    if (!KEYS.includes(key)) throw new Error(`${file}: unknown frontmatter field "${match[1]}".`);
    if (key in fields) throw new Error(`${file}: "${key}" is set twice.`);
    fields[key] = scalar(match[2]!);
  }
  const required = (key: "title" | "date" | "summary") => {
    const value = fields[key];
    if (value === undefined || value === "") throw new Error(`${file}: "${key}" is required.`);
    return value;
  };
  const date = (key: "date" | "updated", value: string) => {
    if (!isDate(value))
      throw new Error(`${file}: "${key}" must be a YYYY-MM-DD date, not "${value}".`);
    return value;
  };
  const draft = fields.draft ?? "false";
  if (draft !== "true" && draft !== "false") {
    throw new Error(`${file}: "draft" must be true or false, not "${draft}".`);
  }
  const meta: PostMeta = {
    title: required("title"),
    lcd: fields.lcd === "" ? undefined : fields.lcd,
    date: date("date", required("date")),
    updated: fields.updated === undefined ? undefined : date("updated", fields.updated),
    summary: required("summary"),
    draft: draft === "true",
  };
  if (meta.updated !== undefined && meta.updated < meta.date) {
    throw new Error(`${file}: "updated" (${meta.updated}) is before "date" (${meta.date}).`);
  }
  return meta;
}

/** Words of prose in an MDX body: code blocks, imports and JSX tags don't count. */
export function proseWords(body: string): number {
  const prose = body
    .replace(/^(```|~~~)[\s\S]*?^\1/gm, " ")
    .replace(/^(import|export) .*$/gm, " ")
    .replace(/<[^>]*>/g, " ");
  return prose.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word)).length;
}

/** Minutes to read `words` at 230 a minute, at least one. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}
