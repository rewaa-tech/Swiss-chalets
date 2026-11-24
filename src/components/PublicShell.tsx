import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import WhatsAppFab from "./WhatsAppFab";
import ThemeSetter from "./ThemeSetter";
import type { Theme } from "@/lib/services/theme";
import { resolveContact, type PageType } from "@/lib/services/contacts";

export default async function PublicShell({ theme, page, entityId, branchId, waText, active, children, header = true, footer = true }: {
  theme: Theme; page: PageType; entityId?: number | null; branchId?: number | null; waText: string; active?: string;
  children: React.ReactNode; header?: boolean; footer?: boolean;
}) {
  const phone = await resolveContact(page, entityId, branchId);
  return (
    <div data-theme={theme} className="min-h-screen" style={{ background: "var(--bg)" }}>
      <ThemeSetter theme={theme} />
      {header && <SiteHeader active={active} />}
      <main id="main">{children}</main>
      {footer && <SiteFooter />}
      <WhatsAppFab phone={phone} text={waText} />
    </div>
  );
}
