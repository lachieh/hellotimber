import { expect, it } from "vite-plus/test";
import { imeiForHash } from "../src/phone/imei";
it("makes stable 35-prefixed fifteen-digit IMEIs with a Luhn check digit", () => {
  for (const hash of ["devbuild", "c729145", "", "0123456789abcdef"]) {
    const imei = imeiForHash(hash);
    expect(imei).toMatch(/^35[0-9]{13}$/);
    expect(imeiForHash(hash)).toBe(imei);
    const total = imei
      .split("")
      .reverse()
      .reduce((sum, char, i) => {
        const n = Number(char) * (i % 2 ? 2 : 1);
        return sum + (n > 9 ? n - 9 : n);
      }, 0);
    expect(total % 10).toBe(0);
  }
  expect(imeiForHash("abc")).not.toBe(imeiForHash("def"));
});
