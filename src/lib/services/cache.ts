// Shared via globalThis: Next bundles route handlers and server actions separately,
// so module-level state would not be shared between them.
const g = globalThis as unknown as { __scCache?: Map<string, { at: number; v: unknown }> };
const store = (g.__scCache ??= new Map<string, { at: number; v: unknown }>());
const TTL = 30_000;

export function cacheGet<T>(k: string): T | undefined {
  const e = store.get(k);
  if (!e) return undefined;
  if (Date.now() - e.at > TTL) { store.delete(k); return undefined; }
  return e.v as T;
}
export function cacheSet(k: string, v: unknown) { store.set(k, { at: Date.now(), v }); }
export function invalidateUnit(unitId: number) {
  for (const k of store.keys()) if (k.startsWith(`u:${unitId}:`)) store.delete(k);
}
export function invalidateUnits(ids: Iterable<number>) { for (const id of ids) invalidateUnit(id); }
export function invalidateAll() { store.clear(); }
