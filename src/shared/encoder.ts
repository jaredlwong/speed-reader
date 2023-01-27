import { gzip, ungzip } from "pako";

export function base64UrlEncode(str: string): string {
  const compressed = gzip(str);
  const base64 = Buffer.from(compressed).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ".");
}

export function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/").replace(/\./g, "=");
  const compressed = Buffer.from(base64, "base64");
  return ungzip(compressed, { to: "string" });
}
