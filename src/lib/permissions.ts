/**
 * v3 §6 — fine-grained permissions. Each one can be granted or withheld on its own.
 * `needs` lists the permissions it depends on (granting it grants them; revoking them revokes it).
 */
export interface PermissionDef { label: string; hint: string; group: GroupKey; needs?: string[] }
type GroupKey = keyof typeof PERMISSION_GROUPS;

export const PERMISSION_GROUPS = {
  bookings: { label: "الحجوزات", icon: "list" },
  units: { label: "الوحدات", icon: "home" },
  pricing: { label: "المواسم والفترات والأسعار", icon: "tag" },
  calendar: { label: "التقويم", icon: "calendar" },
  content: { label: "المحتوى", icon: "edit" },
  blocklist: { label: "الحظر", icon: "ban" },
  branch: { label: "الفرع", icon: "settings" },
  staff: { label: "الموظفون", icon: "users" },
} as const;

export const PERMISSIONS = {
  "bookings.view": { group: "bookings", label: "عرض الحجوزات", hint: "يشوف قائمة الطلبات والحجوزات وتفاصيلها" },
  "bookings.view_proof": { group: "bookings", label: "عرض إشعارات الدفع", hint: "يفتح صورة أو PDF إشعار شام كاش", needs: ["bookings.view"] },
  "bookings.confirm": { group: "bookings", label: "تثبيت الحجوزات", hint: "يقدر يثبّت الحجز بعد مراجعة الإشعار", needs: ["bookings.view", "bookings.view_proof"] },
  "bookings.reject": { group: "bookings", label: "رفض الطلبات", hint: "يرفض الطلب مع ذكر السبب", needs: ["bookings.view", "bookings.view_proof"] },
  "bookings.block": { group: "bookings", label: "الرفض مع الحظر", hint: "يرفض ويحظر الرقم والجهاز", needs: ["bookings.reject"] },
  "bookings.void": { group: "bookings", label: "إلغاء لعدم الثبوتيات", hint: "يسجّل الحجز ملغى إذا ما أحضر الزبون الثبوتيات", needs: ["bookings.view"] },
  "bookings.manual": { group: "bookings", label: "الحجز اليدوي", hint: "ينشئ حجزًا مثبّتًا مباشرة من اللوحة", needs: ["bookings.view"] },
  "bookings.export": { group: "bookings", label: "تصدير الحجوزات", hint: "ينزّل الحجوزات كملف CSV", needs: ["bookings.view"] },

  "units.view": { group: "units", label: "عرض الوحدات", hint: "يشوف قائمة الوحدات وبياناتها" },
  "units.create": { group: "units", label: "إضافة وحدات", hint: "يضيف كوخ أو مزرعة جديدة", needs: ["units.view", "units.edit"] },
  "units.edit": { group: "units", label: "تعديل الوحدات", hint: "يعدّل الاسم والوصف والسعة والمرافق والقواعد", needs: ["units.view"] },
  "units.media": { group: "units", label: "الصور والفيديو", hint: "يغيّر صورة الغلاف ويدير ألبوم الصور والفيديو", needs: ["units.view"] },
  "units.toggle": { group: "units", label: "تفعيل وتعطيل الوحدات", hint: "يخفي الوحدة عن الزبائن أو يظهرها", needs: ["units.view"] },

  "seasons.manage": { group: "pricing", label: "المواسم والأنماط", hint: "يحدد تواريخ المواسم ونمط كل وحدة (مسبح أو فندقي)" },
  "slots.view": { group: "pricing", label: "عرض الفترات والأسعار", hint: "يشوف الفترات وأسعارها" },
  "slots.manage": { group: "pricing", label: "إدارة الفترات والأسعار", hint: "يضيف ويعدّل ويعطّل الفترات ويغيّر الأسعار", needs: ["slots.view"] },

  "calendar.view": { group: "calendar", label: "عرض التقويم التشغيلي", hint: "يشوف الأيام المفتوحة والمحجوزة" },
  "calendar.open_close": { group: "calendar", label: "فتح وإغلاق الأيام", hint: "يفتح الأيام للحجز أو يغلقها", needs: ["calendar.view"] },

  "content.manage": { group: "content", label: "نصوص الواجهة", hint: "يعدّل النصوص اللي بتظهر للزبائن على صفحات الفرع" },

  "blocklist.view": { group: "blocklist", label: "عرض المحظورين", hint: "يشوف قائمة المحظورين وأسباب الحظر" },
  "blocklist.manage": { group: "blocklist", label: "رفع الحظر", hint: "يرفع الحظر عن رقم أو جهاز", needs: ["blocklist.view"] },

  "branch.settings": { group: "branch", label: "إعدادات الفرع", hint: "أوقات المراجعة وتيليغرام والموقع على الخريطة" },
  "branch.payment": { group: "branch", label: "حساب شام كاش", hint: "يغيّر اسم ورقم حساب شام كاش ورمز QR", needs: ["branch.settings"] },

  "staff.view": { group: "staff", label: "عرض الموظفين", hint: "يشوف الموظفين وصلاحياتهم" },
  "staff.create": { group: "staff", label: "إضافة موظفين", hint: "يضيف موظف جديد بكلمة مرور مؤقتة", needs: ["staff.view"] },
  "staff.edit_permissions": { group: "staff", label: "تعديل الصلاحيات", hint: "يغيّر صلاحيات الموظفين (ضمن صلاحياته فقط)", needs: ["staff.view"] },
  "staff.disable": { group: "staff", label: "تعطيل الحسابات", hint: "يعطّل حساب موظف وينهي جلساته فورًا", needs: ["staff.view"] },
} as const satisfies Record<string, PermissionDef>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
/** Every permission can be delegated, but only by someone who holds it. */
export const GRANTABLE = ALL_PERMISSIONS;
export const isPermission = (p: string): p is Permission => p in PERMISSIONS;

/** Ready-made sets offered as one-click presets when adding an account. */
export const PERMISSION_PRESETS: { key: string; label: string; hint: string; perms: Permission[] }[] = [
  { key: "reviewer", label: "مراجع حجوزات", hint: "يراجع الإشعارات ويثبّت أو يرفض", perms: ["bookings.view", "bookings.view_proof", "bookings.confirm", "bookings.reject", "bookings.void", "calendar.view"] },
  { key: "content", label: "مدير محتوى", hint: "الصور والنصوص وبيانات الوحدات", perms: ["units.view", "units.edit", "units.media", "content.manage"] },
  { key: "pricing", label: "مسؤول أسعار", hint: "المواسم والفترات والأسعار والتقويم", perms: ["seasons.manage", "slots.view", "slots.manage", "calendar.view", "calendar.open_close", "units.view"] },
  { key: "readonly", label: "قراءة فقط", hint: "يشوف بدون ما يعدّل", perms: ["bookings.view", "units.view", "slots.view", "calendar.view", "blocklist.view", "staff.view"] },
  { key: "all", label: "كل الصلاحيات", hint: "كل ما تملكه أنت", perms: ALL_PERMISSIONS },
];

/** Adds every dependency (transitively). */
export function withDependencies(perms: Iterable<string>): Set<Permission> {
  const out = new Set<Permission>();
  const add = (p: string) => {
    if (!isPermission(p) || out.has(p)) return;
    out.add(p);
    for (const n of (PERMISSIONS[p] as PermissionDef).needs ?? []) add(n);
  };
  for (const p of perms) add(p);
  return out;
}

export type Role = "SuperAdmin" | "BranchManager" | "Staff";

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  branchId: number | null;
  permissions: Set<Permission>;
  mustChangePassword: boolean;
}

/**
 * Branch managers have every branch permission unless the super admin chose a custom set
 * for them (`customManagerPerms`). Staff have exactly what was granted. Unknown names are ignored.
 */
export function effectivePermissions(role: Role, granted: string[], customManagerPerms = false): Set<Permission> {
  if (role === "BranchManager") return customManagerPerms ? withDependencies(granted) : new Set(ALL_PERMISSIONS);
  if (role === "Staff") return withDependencies(granted);
  return new Set();
}

/** Grant rule: nobody can hand out a permission they do not hold (the super admin holds all). */
export function assertCanGrant(grantor: { role: Role; permissions: Set<Permission> }, perms: Iterable<Permission>): Permission | null {
  if (grantor.role === "SuperAdmin") return null;
  for (const p of perms) if (!grantor.permissions.has(p)) return p;
  return null;
}
