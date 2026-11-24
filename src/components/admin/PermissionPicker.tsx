"use client";
import { useMemo, useState } from "react";
import Icon from "../Icon";
import { PERMISSIONS, PERMISSION_GROUPS, PERMISSION_PRESETS, isPermission, type Permission, type PermissionDef } from "@/lib/permissions";

const DEFS = PERMISSIONS as Record<Permission, PermissionDef>;
const ALL = Object.keys(PERMISSIONS) as Permission[];

/** Everything that (transitively) depends on p. */
function dependents(p: Permission): Set<Permission> {
  const out = new Set<Permission>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const q of ALL) {
      if (out.has(q)) continue;
      const needs = DEFS[q].needs ?? [];
      if (needs.includes(p) || needs.some((n) => isPermission(n) && out.has(n))) { out.add(q); grew = true; }
    }
  }
  return out;
}
function closure(p: Permission, acc = new Set<Permission>()) {
  if (acc.has(p)) return acc;
  acc.add(p);
  for (const n of DEFS[p].needs ?? []) if (isPermission(n)) closure(n, acc);
  return acc;
}

/** Which panel pages the account will see (mirrors the branch sidebar). */
const NAV: { label: string; icon: string; perm: Permission }[] = [
  { label: "يحتاج مراجعتك", icon: "inbox", perm: "bookings.view" },
  { label: "الحجوزات", icon: "list", perm: "bookings.view" },
  { label: "التقويم التشغيلي", icon: "calendar", perm: "calendar.view" },
  { label: "الوحدات", icon: "home", perm: "units.view" },
  { label: "المواسم والأنماط", icon: "leaf", perm: "seasons.manage" },
  { label: "الفترات والأسعار", icon: "tag", perm: "slots.view" },
  { label: "الموظفون", icon: "users", perm: "staff.view" },
  { label: "الحظر", icon: "ban", perm: "blocklist.view" },
  { label: "نصوص الواجهة", icon: "edit", perm: "content.manage" },
  { label: "إعدادات الفرع", icon: "settings", perm: "branch.settings" },
];

export default function PermissionPicker({ available, initial = [], name = "perms", summary = true, compact = false }: {
  /** Permissions the person granting holds. Others are shown locked. */
  available: Permission[]; initial?: string[]; name?: string; summary?: boolean; compact?: boolean;
}) {
  const can = useMemo(() => new Set(available), [available]);
  // A permission is grantable only if it and all its dependencies are held.
  const grantable = (p: Permission) => [...closure(p)].every((x) => can.has(x));
  const [sel, setSel] = useState<Set<Permission>>(() => new Set(initial.filter(isPermission).filter((p) => can.has(p))));
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(PERMISSION_GROUPS).map((g) => [g, !compact])));

  const toggle = (p: Permission, on: boolean) => {
    const next = new Set(sel);
    if (on) {
      const add = [...closure(p)].filter((x) => !next.has(x) && x !== p);
      closure(p).forEach((x) => next.add(x));
      setNote(add.length ? `فُعّلت تلقائيًا: ${add.map((x) => DEFS[x].label).join("، ")} — لأن «${DEFS[p].label}» تحتاجها` : null);
    } else {
      const drop = [...dependents(p)].filter((x) => next.has(x));
      next.delete(p); drop.forEach((x) => next.delete(x));
      setNote(drop.length ? `أُلغيت أيضًا: ${drop.map((x) => DEFS[x].label).join("، ")} — لأنها تعتمد على «${DEFS[p].label}»` : null);
    }
    setSel(next);
  };
  const setGroup = (g: string, on: boolean) => {
    const next = new Set(sel);
    for (const p of ALL.filter((x) => DEFS[x].group === g && grantable(x))) {
      if (on) closure(p).forEach((x) => next.add(x));
      else { next.delete(p); dependents(p).forEach((x) => next.delete(x)); }
    }
    setNote(null);
    setSel(next);
  };
  const applyPreset = (perms: Permission[]) => {
    const next = new Set<Permission>();
    for (const p of perms) if (grantable(p)) closure(p).forEach((x) => next.add(x));
    setNote(null);
    setSel(next);
  };
  const presetActive = (perms: Permission[]) => {
    const want = new Set<Permission>();
    for (const p of perms) if (grantable(p)) closure(p).forEach((x) => want.add(x));
    return want.size > 0 && want.size === sel.size && [...want].every((x) => sel.has(x));
  };

  return (
    <div className={`perm-picker ${summary ? "with-summary" : ""}`}>
      <div className="flex flex-col gap-4 min-w-0">
        <div className="flex flex-col gap-2">
          <span className="label">قوالب جاهزة <span className="muted" style={{ fontWeight: 400 }}>(اختر قالبًا ثم عدّل عليه)</span></span>
          <div className="preset-row">
            {PERMISSION_PRESETS.map((pr) => (
              <button type="button" key={pr.key} className={`preset-card ${presetActive(pr.perms) ? "is-on" : ""}`} onClick={() => applyPreset(pr.perms)} aria-pressed={presetActive(pr.perms)}>
                <strong>{pr.label}</strong><span>{pr.hint}</span>
              </button>
            ))}
            <button type="button" className={`preset-card ${sel.size === 0 ? "is-on" : ""}`} onClick={() => applyPreset([])}><strong>بدون</strong><span>ابدأ من الصفر</span></button>
          </div>
        </div>

        {note && <div role="status" className="perm-note"><Icon name="sparkle" size={16} />{note}</div>}

        {Object.entries(PERMISSION_GROUPS).map(([g, meta]) => {
          const perms = ALL.filter((p) => DEFS[p].group === g);
          const on = perms.filter((p) => sel.has(p)).length;
          const allOn = perms.filter(grantable).every((p) => sel.has(p)) && perms.some(grantable);
          return (
            <section key={g} className={`perm-group ${on ? "has-on" : ""}`}>
              <header>
                <button type="button" className="perm-group-head" onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))} aria-expanded={open[g]}>
                  <span className="perm-ico"><Icon name={meta.icon} size={18} /></span>
                  <strong>{meta.label}</strong>
                  <span className="perm-count num">{on}/{perms.length}</span>
                  <Icon name="arrow" size={16} className="perm-chev" />
                </button>
                <label className="switch" title="الكل">
                  <input type="checkbox" checked={allOn} onChange={(e) => setGroup(g, e.target.checked)} disabled={!perms.some(grantable)} aria-label={`كل صلاحيات ${meta.label}`} />
                  <span className="switch-track" /><span className="switch-text">الكل</span>
                </label>
              </header>
              {open[g] && (
                <ul>
                  {perms.map((p) => {
                    const locked = !grantable(p);
                    return (
                      <li key={p} className={locked ? "is-locked" : sel.has(p) ? "is-on" : ""}>
                        <label className="perm-row">
                          <span className="flex flex-col gap-0.5 min-w-0">
                            <span className="perm-name">{locked && <Icon name="lock" size={14} />}{DEFS[p].label}</span>
                            <span className="perm-hint">{locked ? "لا تملك هذه الصلاحية، فلا يمكنك منحها" : DEFS[p].hint}</span>
                          </span>
                          <span className="switch">
                            <input type="checkbox" checked={sel.has(p)} disabled={locked} onChange={(e) => toggle(p, e.target.checked)} data-perm={p} />
                            <span className="switch-track" />
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {[...sel].map((p) => <input key={p} type="hidden" name={name} value={p} />)}
      </div>

      {summary && (
        <aside className="perm-summary" aria-live="polite">
          <h3>ملخص الحساب</h3>
          <div className="flex flex-col gap-1.5">
            <span className="label" style={{ color: "var(--success)" }}>سيتمكن من ({sel.size})</span>
            {sel.size ? <ul className="sum-list ok">{ALL.filter((p) => sel.has(p)).map((p) => <li key={p}><Icon name="check" size={14} />{DEFS[p].label}</li>)}</ul>
              : <span className="muted" style={{ fontSize: 13 }}>لم تختر أي صلاحية بعد</span>}
          </div>
          <details>
            <summary className="label" style={{ color: "var(--stone)", cursor: "pointer" }}>لن يتمكن من ({ALL.length - sel.size})</summary>
            <ul className="sum-list no">{ALL.filter((p) => !sel.has(p)).map((p) => <li key={p}><Icon name="minus" size={14} />{DEFS[p].label}</li>)}</ul>
          </details>
          <div className="flex flex-col gap-2">
            <span className="label">القائمة كما سيراها</span>
            <div className="nav-preview">
              {NAV.filter((n) => sel.has(n.perm)).map((n) => <span key={n.label}><Icon name={n.icon} size={15} />{n.label}</span>)}
              {!NAV.some((n) => sel.has(n.perm)) && <span className="muted">صفحة الحساب فقط</span>}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
