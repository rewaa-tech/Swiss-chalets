import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import WhatsAppFab from "./WhatsAppFab";
import ThemeSetter from "./ThemeSetter";
import InlineTextEditor from "./InlineTextEditor";
import { TextsProvider } from "./Texts";
import type { Theme } from "@/lib/services/theme";
import { resolveContact, type PageType } from "@/lib/services/contacts";
import { getTexts } from "@/lib/texts/server";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";

export default async function PublicShell({ theme, page, entityId, branchId, waText, active, children, header = true, footer = true }: {
  theme: Theme; page: PageType; entityId?: number | null; branchId?: number | null; waText: string; active?: string;
  children: React.ReactNode; header?: boolean; footer?: boolean;
}) {
  const [phone, dict, user] = await Promise.all([resolveContact(page, entityId, branchId), getTexts(branchId), currentUser()]);
  // v3 §5.3: editors get the in-place text editor. Super admin edits site-wide texts;
  // branch staff with content.manage edit their own branch's pages only.
  let editor: { branchScope: boolean; label: string } | null = null;
  if (user && !user.mustChangePassword) {
    if (user.role === "SuperAdmin") editor = { branchScope: false, label: "للموقع كله" };
    else if (user.permissions.has("content.manage") && branchId && user.branchId === branchId) {
      const b = await one<{ name: string }>("SELECT name FROM branches WHERE id = $1", [branchId]);
      editor = { branchScope: true, label: `فرع ${b?.name ?? ""}` };
    }
  }
  return (
    <TextsProvider value={dict}>
      <div data-theme={theme} className="min-h-screen" style={{ background: "var(--bg)" }}>
        <ThemeSetter theme={theme} />
        {header && <SiteHeader active={active} dict={dict} />}
        <main id="main">{children}</main>
        {footer && <SiteFooter dict={dict} />}
        <WhatsAppFab phone={phone} text={waText} label={dict["wa.fab"]} />
        {editor && <InlineTextEditor branchScope={editor.branchScope} scopeLabel={editor.label} />}
      </div>
    </TextsProvider>
  );
}
