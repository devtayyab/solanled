import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, Stat, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { Project } from "@/types/database";

export default async function OverviewPage() {
  await getSessionProfile();
  const supabase = await createClient();

  // RLS scopes everything to the caller's distributor (or all rows for superadmin),
  // so we don't filter by distributor_id explicitly here.
  const [
    { count: signmakerCount },
    { count: projectCount },
    { count: installedCount },
    { count: docViewCount },
    { count: aiRequestCount },
    { data: recentProjectsRaw },
    { data: recentDocViewsRaw },
  ] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "installed"),
    supabase.from("document_views").select("*", { count: "exact", head: true }),
    supabase.from("ai_request_log").select("*", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("id, title, status, location_address, updated_at, company_id, companies(name)")
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("document_views")
      .select("id, viewed_at, documents(title), profiles(full_name), companies(name)")
      .order("viewed_at", { ascending: false })
      .limit(8),
  ]);

  type RecentProject = Project & { companies: { name: string } | null };
  const recentProjects = (recentProjectsRaw ?? []) as unknown as RecentProject[];
  const recentDocViews = recentDocViewsRaw ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500">
          Activity across signmakers in your network.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Signmakers" value={signmakerCount ?? 0} />
        <Stat label="Projects" value={projectCount ?? 0} />
        <Stat
          label="Installed"
          value={installedCount ?? 0}
          hint={projectCount ? `${Math.round(((installedCount ?? 0) / projectCount) * 100)}% of total` : undefined}
        />
        <Stat label="Document views" value={docViewCount ?? 0} />
        <Stat label="Luxa AI requests" value={aiRequestCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Recent project activity" />
          {recentProjects.length === 0 ? (
            <EmptyState title="No projects yet" description="Once signmakers start projects from the mobile app they'll appear here." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentProjects.map((p) => (
                <li key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/projects?id=${p.id}` as never}
                      className="text-sm font-medium text-gray-900 hover:text-brand-700 truncate block"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-gray-500 truncate">
                      {p.companies?.name ?? "—"} · {p.location_address || "no address"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={p.status} />
                    <span className="text-xs text-gray-400">{formatDateTime(p.updated_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent document views" subtitle="What signmakers are reading" />
          {recentDocViews.length === 0 ? (
            <EmptyState title="No document views yet" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentDocViews.map((v: any) => (
                <li key={v.id} className="px-5 py-3">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {v.documents?.title ?? "Document"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {v.profiles?.full_name ?? "Unknown user"} · {v.companies?.name ?? "—"} · {formatDateTime(v.viewed_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
