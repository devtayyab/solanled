import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types/database";

const PORTAL_ROLES: Role[] = ["superadmin", "distributor_admin", "distributor_user"];

export async function getSessionProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (error || !profile) {
    redirect("/login?error=no_profile");
  }

  if (!PORTAL_ROLES.includes(profile.role)) {
    // Signmaker accounts (admin/employee) belong on mobile, not the web portal.
    redirect("/login?error=mobile_only");
  }

  return profile;
}

export function isSuperadmin(profile: Profile) {
  return profile.role === "superadmin";
}
