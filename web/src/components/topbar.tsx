"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

interface Props {
  profile: Profile;
  contextLabel?: string | null;
}

export function Topbar({ profile, contextLabel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const roleLabel: Record<Profile["role"], string> = {
    superadmin: "SloanLED HQ",
    distributor_admin: "Distributor admin",
    distributor_user: "Distributor user",
    admin: "Company admin",
    employee: "Employee",
  };

  return (
    <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        {contextLabel ? <span className="font-medium text-gray-700">{contextLabel}</span> : null}
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm hover:bg-gray-50 rounded-md px-2 py-1.5"
        >
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
            <User size={15} />
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">{profile.full_name || "Unnamed user"}</div>
            <div className="text-xs text-gray-500">{roleLabel[profile.role]}</div>
          </div>
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md border border-gray-200 shadow-lg py-1 z-10">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
