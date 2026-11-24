"use client";
import { useRef, useState } from "react";
import ActionForm, { FieldError, FormError, Submit, type ActionState } from "./ActionForm";
import PermissionPicker from "./PermissionPicker";
import Icon from "../Icon";
import type { Permission } from "@/lib/permissions";

type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;

function makePassword() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const b = new Uint8Array(10);
  crypto.getRandomValues(b);
  return Array.from(b.slice(0, 8), (x) => abc[x % abc.length]).join("") + String(10 + (b[8] % 90));
}

const STEPS = ["البيانات", "الصلاحيات", "المراجعة والحفظ"];

/**
 * v3 §6.2 — add an account in three steps on one page. All fields stay in the form,
 * so the final submit sends everything; the server re-validates every grant.
 */
export default function AccountWizard({ action, available, kind, branches }: {
  action: Act; available: Permission[]; kind: "staff" | "manager"; branches?: { id: number; name: string }[];
}) {
  const [step, setStep] = useState(0);
  const [pwd, setPwd] = useState(makePassword);
  const [mode, setMode] = useState<"all" | "custom">("all");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState(0);
  const form = useRef<HTMLDivElement>(null);
  const val = (n: string) => (form.current?.querySelector(`[name="${n}"]`) as HTMLInputElement | HTMLSelectElement | null)?.value?.trim() ?? "";
  const permCount = () => form.current?.querySelectorAll('input[type=hidden][name="perms"]').length ?? 0;

  const next = () => {
    setErr(null);
    if (step === 0) {
      if (val("display_name").length < 2) return setErr("اكتب الاسم");
      if (!/^[A-Za-z0-9._-]{3,32}$/.test(val("username"))) return setErr("اسم المستخدم: 3–32 حرفًا لاتينيًا أو أرقام، بدون فراغات");
    }
    if (step === 1 && (kind === "staff" || mode === "custom") && !permCount()) return setErr("اختر صلاحية واحدة على الأقل، أو قالبًا جاهزًا");
    setStep((s) => Math.min(2, s + 1));
  };

  return (
    <ActionForm key={key} action={action} className="admin-card flex flex-col gap-5" onDone={(s) => { if (s.ok) { setStep(0); setPwd(makePassword()); setMode("all"); setKey((k) => k + 1); } }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 style={{ fontSize: 18 }}>{kind === "staff" ? "إضافة موظف" : "إضافة مدير فرع"}</h2>
        <ol className="wizard-steps" aria-label="خطوات الإضافة">
          {STEPS.map((t, i) => <li key={t} className={i === step ? "is-now" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}><span className="num">{i < step ? "✓" : i + 1}</span>{t}</li>)}
        </ol>
      </div>

      <div ref={form} className="flex flex-col gap-4">
        <div hidden={step !== 0} className="grid gap-3 md:grid-cols-2">
          <div className="field"><label className="label" htmlFor="ac-d">الاسم الكامل</label><input id="ac-d" name="display_name" className="input" autoComplete="off" /><FieldError name="display_name" /></div>
          <div className="field"><label className="label" htmlFor="ac-u">اسم المستخدم (للدخول)</label><input id="ac-u" name="username" className="input" dir="ltr" autoComplete="off" placeholder="ahmad.idlib" /><FieldError name="username" /></div>
          {kind === "manager" && branches && (
            <div className="field"><label className="label" htmlFor="ac-b">الفرع</label><select id="ac-b" name="branch_id" className="select">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><FieldError name="branch_id" /></div>
          )}
          <div className="field">
            <label className="label" htmlFor="ac-p">كلمة مرور مؤقتة <span className="muted" style={{ fontWeight: 400 }}>(يُطلب تغييرها بأول دخول)</span></label>
            <div className="flex gap-2">
              <input id="ac-p" name="password" className="input num" dir="ltr" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" style={{ flex: 1 }} />
              <button type="button" className="btn btn-outline btn-icon" aria-label="نسخ كلمة المرور" onClick={() => { navigator.clipboard?.writeText(pwd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}><Icon name={copied ? "check" : "copy"} size={18} /></button>
              <button type="button" className="btn btn-outline btn-icon" aria-label="توليد كلمة مرور جديدة" onClick={() => setPwd(makePassword())}><Icon name="replay" size={18} /></button>
            </div>
            <FieldError name="password" />
          </div>
        </div>

        <div hidden={step !== 1} className="flex flex-col gap-4">
          {kind === "manager" && (
            <div className="seg" role="radiogroup" aria-label="نوع الصلاحيات">
              <label className={mode === "all" ? "is-on" : ""}><input type="radio" name="perm_mode" value="all" checked={mode === "all"} onChange={() => setMode("all")} />كل صلاحيات الفرع</label>
              <label className={mode === "custom" ? "is-on" : ""}><input type="radio" name="perm_mode" value="custom" checked={mode === "custom"} onChange={() => setMode("custom")} />صلاحيات مخصصة</label>
            </div>
          )}
          {(kind === "staff" || mode === "custom") ? <PermissionPicker available={available} initial={kind === "staff" ? ["bookings.view"] : available} />
            : <p className="muted" style={{ margin: 0 }}>المدير رح يملك كل صلاحيات فرعه، ويقدر يمنح موظفيه جزءًا منها.</p>}
        </div>

        {step === 2 && <Review get={val} mode={kind === "staff" ? "custom" : mode} count={permCount()} branches={branches} />}
      </div>

      {err && <div role="alert" className="field-error" style={{ padding: "10px 14px", borderRadius: 12, background: "#F8DEDB" }}>{err}</div>}
      <FormError />
      <div className="flex gap-2 justify-between flex-wrap">
        <button type="button" className="btn btn-outline" onClick={() => { setErr(null); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0}>السابق</button>
        {step < 2 ? <button type="button" className="btn btn-dark" onClick={next}>التالي<Icon name="back" size={18} style={{ transform: "scaleX(-1)" }} /></button>
          : <Submit className="btn btn-cta" pendingText="جاري الحفظ…">{kind === "staff" ? "إضافة الموظف" : "إضافة المدير"}</Submit>}
      </div>
    </ActionForm>
  );
}

function Review({ get, mode, count, branches }: { get: (n: string) => string; mode: string; count: number; branches?: { id: number; name: string }[] }) {
  const branch = branches?.find((b) => String(b.id) === get("branch_id"))?.name;
  return (
    <dl className="review-grid">
      <div><dt>الاسم</dt><dd>{get("display_name")}</dd></div>
      <div><dt>اسم المستخدم</dt><dd dir="ltr">{get("username")}</dd></div>
      {branch && <div><dt>الفرع</dt><dd>{branch}</dd></div>}
      <div><dt>كلمة المرور المؤقتة</dt><dd dir="ltr" className="num">{get("password")}</dd></div>
      <div><dt>الصلاحيات</dt><dd>{mode === "all" ? "كل صلاحيات الفرع" : `${count} صلاحية`}</dd></div>
    </dl>
  );
}
