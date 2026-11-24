export const PERMISSIONS = {
  "units.manage": "الوحدات",
  "pricing.manage": "المواسم والأنماط والأسعار",
  "slots.manage": "الفترات",
  "calendar.manage": "فتح وإغلاق الأيام",
  "bookings.view": "عرض الحجوزات",
  "bookings.review": "التثبيت والرفض والحجز اليدوي",
  "blocklist.manage": "الحظر",
  "branch.settings": "إعدادات الفرع",
  "staff.manage": "الموظفون",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
/** Permissions a manager can never delegate. */
export const MANAGER_ONLY: Permission[] = ["branch.settings", "staff.manage"];
export const GRANTABLE = ALL_PERMISSIONS.filter((p) => !MANAGER_ONLY.includes(p));

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

export function effectivePermissions(role: Role, granted: string[]): Set<Permission> {
  if (role === "BranchManager") return new Set(ALL_PERMISSIONS);
  if (role === "Staff") return new Set(granted.filter((p): p is Permission => GRANTABLE.includes(p as Permission)));
  return new Set();
}
