/** Only plain text is stored. Long texts may use **bold**, line breaks and [label](https://link). */
export function sanitizeText(v: string, long: boolean): string {
  let s = v.replace(/\r\n?/g, "\n").replace(/[<>]/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (!long) s = s.replace(/\n+/g, " ");
  return s.trim();
}
