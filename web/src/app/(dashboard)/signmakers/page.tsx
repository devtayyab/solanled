import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function SignmakersPage() {
  await getSessionProfile();
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, country, address, created_at")
    .order("name");

  const list = companies ?? [];

  // Per-company aggregates. Done as separate queries to keep RLS straightforward;
  // for >100 signmakers, switch to a SQL view.
  const ids = list.map((c) => c.id);
  const [{ data: projectAgg }, { data: docViewAgg }] = await Promise.all([
    ids.length
      ? supabase.from("projects").select("company_id, status").in("company_id", ids)
      : Promise.resolve({ data: [] as { company_id: string; status: string }[] }),
    ids.length
      ? supabase.from("document_views").select("company_id").in("company_id", ids)
      : Promise.resolve({ data: [] as { company_id: string }[] }),
  ]);

  const projectStats = new Map<string, { total: number; installed: number }>();
  for (const row of projectAgg ?? []) {
    const s = projectStats.get(row.company_id) ?? { total: 0, installed: 0 };
    s.total += 1;
    if (row.status === "installed" || row.status === "completed") s.installed += 1;
    projectStats.set(row.company_id, s);
  }
  const docStats = new Map<string, number>();
  for (const row of docViewAgg ?? []) {
    docStats.set(row.company_id, (docStats.get(row.company_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Signmakers</h1>
        <p className="text-sm text-gray-500">
          Companies in your distributor network. Click one to drill into projects and activity.
        </p>
      </div>

      <Card>
        <CardHeader title={`${list.length} signmaker${list.length === 1 ? "" : "s"}`} />
        {list.length === 0 ? (
          <EmptyState
            title="No signmakers yet"
            description="When SloanLED HQ assigns signmakers to your distributor account they will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Name</th>
                  <th className="text-left px-5 py-2.5 font-medium">Country</th>
                  <th className="text-right px-5 py-2.5 font-medium">Projects</th>
                  <th className="text-right px-5 py-2.5 font-medium">Installed</th>
                  <th className="text-right px-5 py-2.5 font-medium">Doc views</th>
                  <th className="text-right px-5 py-2.5 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((c) => {
                  const ps = projectStats.get(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/signmakers/${c.id}` as never}
                          className="font-medium text-gray-900 hover:text-brand-700"
                        >
                          {c.name}
                        </Link>
                        <div className="text-xs text-gray-500">{c.address || "—"}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{c.country || "—"}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{ps?.total ?? 0}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{ps?.installed ?? 0}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{docStats.get(c.id) ?? 0}</td>
                      <td className="px-5 py-3 text-right text-gray-500 text-xs">{formatDate(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
