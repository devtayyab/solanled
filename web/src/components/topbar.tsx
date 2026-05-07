"use client";

import { User } from "lucide-react";
import type { Profile } from "@/types/database";

interface Props {
  profile: Profile;
  contextLabel?: string | null;
}

export function Topbar({ profile, contextLabel }: Props) {
  const roleLabel: Record<Profile["role"], string> = {
    superadmin: "SloanLED HQ",
    distributor_admin: "Distributor admin",
    distributor_user: "Distributor user",
    admin: "Company admin",
    employee: "Employee",
    signmaker: "Signmaker",
    installer: "Installer",
  };

  return (
    <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        {contextLabel ? <span className="font-medium text-gray-700">{contextLabel}</span> : null}
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 text-sm px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
            <User size={15} />
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">{profile.full_name || "Unnamed user"}</div>
            <div className="text-xs text-gray-500">{roleLabel[profile.role]}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
