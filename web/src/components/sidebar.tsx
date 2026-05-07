"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  FileText,
  Users,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/database";

interface Props {
  role: Role;
}

export function Sidebar({ role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isSuperadmin = role === "superadmin";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const items = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/signmakers", label: "Signmakers", icon: Building2 },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/documents", label: "Document activity", icon: FileText },
    ...(isSuperadmin
      ? [{ href: "/distributors", label: "Distributors", icon: Users }]
      : []),
  ];

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="text-lg font-semibold text-brand-700">SloanLED</div>
        <div className="text-xs text-gray-500">Distributor Portal</div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href as never}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
