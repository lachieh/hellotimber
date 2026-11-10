// Standard base64 (RFC 4648 §4, padded). Written out because the SDK also runs where `btoa` and
// `Buffer` do not exist (an SES compartment).

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeBase64(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const left = bytes.length - i;
    const group = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    text += ALPHABET[group >> 18]! + ALPHABET[(group >> 12) & 63]!;
    text += left > 1 ? ALPHABET[(group >> 6) & 63]! : "=";
    text += left > 2 ? ALPHABET[group & 63]! : "=";
  }
  return text;
}

/** Throws unless `text` is exactly what `encodeBase64` writes for some bytes. */
export function decodeBase64(text: string): Uint8Array {
  if (text.length % 4 !== 0) throw new Error("Invalid base64: the length is not a multiple of 4");
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((text.length / 4) * 3 - padding);
  let at = 0;
  for (let i = 0; i < text.length; i += 4) {
    let group = 0;
    for (let j = 0; j < 4; j++) {
      const digit = i + j >= text.length - padding ? 0 : ALPHABET.indexOf(text[i + j]!);
      if (digit < 0) throw new Error(`Invalid base64: unexpected ${JSON.stringify(text[i + j])}`);
      group = (group << 6) | digit;
    }
    // The bits past the last byte of a padded group must be zero.
    if (at + 3 > bytes.length && (group & ((1 << (8 * (at + 3 - bytes.length))) - 1)) !== 0) {
      throw new Error("Invalid base64: non-zero padding bits");
    }
    for (let shift = 16; shift >= 0 && at < bytes.length; shift -= 8) {
      bytes[at++] = (group >> shift) & 0xff;
    }
  }
  return bytes;
}
