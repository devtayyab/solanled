import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { Project } from "@/types/database";

export default async function ProjectsPage() {
  await getSessionProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("projects")
    .select("id, title, status, location_address, installed_at, updated_at, company_id, companies(name)")
    .order("updated_at", { ascending: false })
    .limit(200);

  type Row = Project & { companies: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500">All projects across your signmaker network.</p>
      </div>

      <Card>
        <CardHeader title={`${rows.length} project${rows.length === 1 ? "" : "s"}`} subtitle="Most recent first (max 200)" />
        {rows.length === 0 ? (
          <EmptyState title="No projects yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Title</th>
                  <th className="text-left px-5 py-2.5 font-medium">Signmaker</th>
                  <th className="text-left px-5 py-2.5 font-medium">Location</th>
                  <th className="text-left px-5 py-2.5 font-medium">Status</th>
                  <th className="text-right px-5 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{p.title}</td>
                    <td className="px-5 py-3 text-gray-700">
                      <Link
                        href={`/signmakers/${p.company_id}` as never}
                        className="hover:text-brand-700"
                      >
                        {p.companies?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{p.location_address || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">{formatDateTime(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
