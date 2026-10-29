export function imeiForHash(hash: string): string {
  let value = 2166136261;
  for (const byte of new TextEncoder().encode(hash))
    value = Math.imul(value ^ byte, 16777619) >>> 0;
  const body = `35${String(value).padStart(12, "0")}`;
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[i]) * (i % 2 === 1 ? 2 : 1);
    sum += digit > 9 ? digit - 9 : digit;
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}
