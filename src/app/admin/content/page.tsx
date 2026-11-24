import { PageHead } from "@/components/admin/AdminShell";
import TextEditor from "@/components/admin/TextEditor";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { buildEditorRows, PAGE_LABELS } from "@/lib/texts/editor-rows";

export const dynamic = "force-dynamic";

export default async function AdminContent() {
  await requireUser("admin");
  const [rows, b, unit] = await Promise.all([
    buildEditorRows({ branchId: null }),
    one<{ slug: string }>("SELECT slug FROM branches WHERE status = 'Active' ORDER BY sort_order, id LIMIT 1"),
    one<{ slug: string }>("SELECT u.slug FROM units u JOIN branches b ON b.id = u.branch_id WHERE u.is_active AND b.status = 'Active' ORDER BY u.sort_order, u.id LIMIT 1"),
  ]);
  const unitUrl = unit ? `/u/${encodeURIComponent(unit.slug)}` : "/";
  const previews: Record<string, string> = { common: "/", home: "/", my: "/my", terms: "/terms", ...(b ? { branch: `/b/${b.slug}`, map: `/b/${b.slug}#location` } : {}), unit: unitUrl, calendar: unitUrl, mechanism: unitUrl, form: unitUrl };
  return (
    <>
      <PageHead title="نصوص الواجهة" sub="النص العام لكل الموقع. كل فرع بيقدر يعدّل نصوص صفحاته، وإذا ما عدّلها بيظهر هالنص." />
      <TextEditor rows={rows} pages={PAGE_LABELS} previews={previews} scopeLabel="الموقع كله" />
    </>
  );
}
