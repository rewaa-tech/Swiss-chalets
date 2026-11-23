import { one } from "../db";

export type PageType = "Home" | "Branch" | "Unit" | "Booking" | "Terms" | "My";

/** page_contacts (exact entity → page type) → branch number → default number. */
export async function resolveContact(page: PageType, entityId?: number | null, branchId?: number | null): Promise<string | null> {
  const r = await one<{ phone_e164: string }>(
    `SELECT phone_e164 FROM (
       SELECT 1 AS rank, c.phone_e164 FROM page_contacts pc JOIN contact_numbers c ON c.id = pc.contact_id AND c.is_active
        WHERE pc.page_type = $1 AND pc.entity_id = $2::int
       UNION ALL
       SELECT 2, c.phone_e164 FROM page_contacts pc JOIN contact_numbers c ON c.id = pc.contact_id AND c.is_active
        WHERE pc.page_type = $1 AND pc.entity_id IS NULL
       UNION ALL
       (SELECT 3, phone_e164 FROM contact_numbers WHERE branch_id = $3::int AND is_active ORDER BY id LIMIT 1)
       UNION ALL
       (SELECT 4, phone_e164 FROM contact_numbers WHERE is_default AND is_active LIMIT 1)
     ) x ORDER BY rank LIMIT 1`,
    [page, entityId ?? null, branchId ?? null]);
  return r?.phone_e164 ?? null;
}
