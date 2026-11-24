import "server-only";
import { headers, cookies } from "next/headers";
import { getSettings } from "./settings";
import { ipHash, deviceHash } from "./services/abuse-guard";

/** Client IP. The app listens on 127.0.0.1 behind Nginx, which sets X-Real-IP (KnownProxies = 127.0.0.1). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",").pop()?.trim() || "0.0.0.0";
}

export async function identityHashes() {
  const s = await getSettings();
  const h = await headers();
  const did = (await cookies()).get("sc_did")?.value ?? "none";
  const ip = await clientIp();
  return { ip, ipHash: ipHash(ip, s.hash_salt ?? ""), deviceHash: deviceHash(did, h.get("user-agent") ?? "", s.hash_salt ?? "") };
}
