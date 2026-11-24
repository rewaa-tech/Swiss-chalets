import { q, type Db } from "./db";

export async function audit(
  e: { userId?: number | null; branchId?: number | null; action: string; entity: string; entityId?: string | number | null; details?: unknown; isManual?: boolean },
  db?: Db,
) {
  await q(
    "INSERT INTO audit_logs (user_id, branch_id, action, entity, entity_id, details, is_manual) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [e.userId ?? null, e.branchId ?? null, e.action, e.entity, e.entityId != null ? String(e.entityId) : null, e.details ? JSON.stringify(e.details) : null, e.isManual ?? false],
    db,
  );
}
