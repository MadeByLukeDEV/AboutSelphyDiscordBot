import { AppShell } from "@/components/shell/app-shell";
import { requireStaffPage } from "@/modules/auth";

// Everything in this group is staff-only. The proxy is the first gate; this
// re-checks (prefetches skip the proxy) and gives the pages one shared shell.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffPage("/");
  return <AppShell session={session}>{children}</AppShell>;
}
