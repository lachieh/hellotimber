# Content handoff — replace all SAMPLE DATA before launch

Everything fabricated in this repo is annotated `// SAMPLE DATA — replace with real copy`
and is obviously fake (Acme Pixel Co., `example.com`, `hellotimber.example`). This file is
the exhaustive checklist: swap in real copy, then run the final gate.

Find every sample block at any time with:

```sh
grep -rn "SAMPLE DATA" website/src website/public
grep -rn "example" website/src/content        # should find no example.com / *-handle after handoff
```

## Files to edit (with the fields in each)

### `website/src/content/site.ts` — canonical site facts (SEO/JSON-LD)

- [ ] `url` — the **deployed origin**, no trailing slash (e.g. `https://lachlanheywood.com`).
      Drives `sitemap.xml`, canonical meta, JSON-LD `url`. Also update the matching line in
      `website/public/robots.txt` (the `Sitemap:` URL).
- [ ] `jobTitle` — real role for the JSON-LD `Person`.
- [ ] `description` — default meta description (1–2 sentences).
- [ ] `tagline` — short one-liner (home `<title>` companion + JSON-LD description).
- [ ] `sameAs` — real social profile URLs (GitHub, LinkedIn, X, …).

### `website/src/content/phonebook.ts` — Phone book / contact card

- [ ] `email` — real address (update both `value` and the `mailto:` `href`).
- [ ] `github`, `linkedin` — real handles (`value` + `href`).
- [ ] `cv` — drop a real `cv.pdf` into `website/public/` and point `href` at `/cv.pdf`
      (or remove the CV entry if you don't want one).

### `website/src/content/messages.ts` — Inbox SMS + contact-form target

- [ ] `inbox[]` — 3–5 real "about me" blurbs. **Each `text` must be ≤160 chars**
      (the content test enforces it) and `timestamp` a valid ISO 8601 string.
- [ ] `writeMessage.destinationEmail` — where the handset's Write-messages editor and the
      panel's "Email me directly" link should deliver.
- [ ] `writeMessage.subject` — the prefilled subject line.

### `website/src/content/chat.ts` — Chat (testimonials)

- [ ] `chatMessages[]` — real testimonials (with permission): `nickname` + `text` per line,
      `who: "them" | "me"`. Or delete the entries / the Chat menu copy if none.

### `website/src/content/call-register.ts` — work history & projects

- [ ] `roles[]` — Received calls: `org`, `title`, `period`, `periodStart` (ISO, e.g. `2022-03`),
      `summary`.
- [ ] `projects[]` — Dialled numbers: `name`, optional `url`, `blurb`, `year`.
- [ ] `missedCalls[]` — the playful "ones that got away".

### `website/src/content/reminders.ts` — Reminders ("now")

- [ ] `nowItems[]` — current learning/building/reading items.

### `website/src/content/clock.ts` — Clock

- [ ] `timeZone` — IANA zone (e.g. `Australia/Brisbane`).
- [ ] `availability` — one line.

### `website/src/content/profiles.ts` — Profiles (stretch)

- [ ] Keep the stub copy, or define real visitor modes (stretch goal).

### `website/src/content/divert.ts` — Call divert (external links)

- [ ] `diverts[]` — real external profile links.

### `website/src/routes/_phone/index.tsx` — standby bio

- [ ] Replace the placeholder bio paragraph (marked `SAMPLE DATA`) with the real bio.

### `website/public/robots.txt`

- [ ] Replace `hellotimber.example` in the `Sitemap:` line with the real origin (match `site.url`).

### Optional

- [ ] `website/public/favicon.svg` — generic green-pixel phone glyph; fine to keep or replace.
- [ ] OG image — none ships; add one + an `og:image` meta if desired.

## Final gate (after replacing copy)

```sh
grep -rn "SAMPLE DATA" website/src website/public   # → no matches
grep -rn "example" website/src/content              # → no example.com / *-handle left
mise exec -- vp run ready                            # check + all package tests + build, green
```

## Definition of done (VISION)

- Boot animation plays; standby reads the real carrier line.
- Every menu route is reachable by keypad AND by URL AND crawlable (view-source shows panel copy).
- Snake is playable with a persisting top score.
- Sound works and respects Settings (keypad tones, mute).
- Lighthouse Accessibility ≥ 95 on a content route.
- `/sitemap.xml` lists the real origin; JSON-LD `Person` present on `/`.

## OPEN DECISION — deployment target (Task 10 Step 4)

The single tracked open item. All options support TanStack Start SSR; once chosen, the follow-up
is: add the target's adapter/config + a deploy job to `.github/workflows/ci.yml` gated on `master`.

- **Cloudflare (Pages/Workers)** — cheapest edge SSR. Add the TanStack Start Cloudflare target +
  `wrangler`; deploy via `cloudflare/wrangler-action` and a `wrangler.toml`.
- **Vercel** — zero-config TanStack Start preset; connect the repo in the dashboard (no workflow
  file needed) or use the Vercel CLI in CI.
- **Netlify** — TanStack Start Netlify adapter + `netlify.toml`; connect the repo.

**DECISION REQUIRED:** pick one, then wire the deploy job.
