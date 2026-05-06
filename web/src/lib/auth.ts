import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types/database";

const PORTAL_ROLES: Role[] = ["superadmin", "distributor_admin", "distributor_user"];

export async function getSessionProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log("[DEBUG] auth user:", user?.id, user?.email);
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (error) {
    console.error("[getSessionProfile] profiles query failed:", error);
    // Keep debug log to see exact DB error in terminal
    console.log("[DEBUG] error:", JSON.stringify(error));
    redirect("/login?error=db_error");
  }

  if (!profile) {
    console.log("[DEBUG] no profile found for user:", user.id);
    redirect("/login?error=no_profile");
  }

  console.log("[DEBUG] role:", profile!.role, "in PORTAL_ROLES:", PORTAL_ROLES.includes(profile!.role));

  if (!PORTAL_ROLES.includes(profile!.role)) {
    redirect("/login?error=mobile_only");
  }

  return profile!;
}

export function isSuperadmin(profile: Profile) {
  return profile.role === "superadmin";
}
