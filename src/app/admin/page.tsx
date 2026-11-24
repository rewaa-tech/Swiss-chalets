import { redirect } from "next/navigation";
export default async function AdminHome({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const ok = (await searchParams).ok;
  redirect(ok ? `/admin/bookings?ok=${encodeURIComponent(ok)}` : "/admin/bookings");
}
