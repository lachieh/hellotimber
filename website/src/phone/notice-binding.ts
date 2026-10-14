import type { Phone } from "@hellotimber/phone-core";

type Notice = { text: string; softkey: string; path?: string };

let target: Pick<Phone, "setNotice"> | null = null;

export function notifyPhone(notice: Notice): void {
  target?.setNotice(notice);
}

export function bindPhoneNotices(phone: Pick<Phone, "setNotice">): () => void {
  target = phone;
  return () => {
    if (target === phone) target = null;
  };
}
