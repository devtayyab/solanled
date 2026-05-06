import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  let contextLabel: string | null = null;
  if (profile.distributor_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("distributors")
      .select("name")
      .eq("id", profile.distributor_id)
      .single();
    if (data?.name) contextLabel = data.name;
  } else if (profile.role === "superadmin") {
    contextLabel = "SloanLED HQ — all distributors";
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={profile.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar profile={profile} contextLabel={contextLabel} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
