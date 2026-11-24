import { PageHead } from "@/components/admin/AdminShell";
import TextEditor from "@/components/admin/TextEditor";
import { requireUser, requirePerm } from "@/lib/auth";
import { one } from "@/lib/db";
import { buildEditorRows, PAGE_LABELS } from "@/lib/texts/editor-rows";

export const dynamic = "force-dynamic";

export default async function BranchContent() {
  const u = await requireUser("branch");
  requirePerm(u, "content.manage");
  const [rows, b, unit] = await Promise.all([
    buildEditorRows({ branchId: u.branchId }),
    one<{ name: string; slug: string }>("SELECT name, slug FROM branches WHERE id = $1", [u.branchId]),
    one<{ slug: string }>("SELECT slug FROM units WHERE branch_id = $1 AND is_active ORDER BY sort_order, id LIMIT 1", [u.branchId]),
  ]);
  // Site-wide pages are edited by the super admin only; the branch sees just its own pages.
  const branchRows = rows.filter((r) => !r.locked);
  const unitUrl = unit ? `/u/${encodeURIComponent(unit.slug)}` : `/b/${b!.slug}`;
  const previews: Record<string, string> = { branch: `/b/${b!.slug}`, unit: unitUrl, calendar: unitUrl, mechanism: unitUrl, form: unitUrl, map: `/b/${b!.slug}#location` };
  return (
    <>
      <PageHead title="نصوص الواجهة" sub={`كل نص يظهر للزبائن على صفحات فرع ${b!.name}. التعديل هون ما بيأثر على الفروع التانية.`} />
      <TextEditor rows={branchRows} pages={PAGE_LABELS} previews={previews} scopeLabel={`فرع ${b!.name}`} />
    </>
  );
}
