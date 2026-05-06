import { redirect } from "next/navigation";
import { getSessionProfile, isSuperadmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function DistributorsPage() {
  const profile = await getSessionProfile();
  if (!isSuperadmin(profile)) redirect("/");

  const supabase = await createClient();

  const { data: distributors } = await supabase
    .from("distributors")
    .select("id, name, region, country, contact_email, is_active, created_at")
    .order("name");

  const list = distributors ?? [];

  // Per-distributor counts of signmakers.
  const ids = list.map((d) => d.id);
  const { data: companyAgg } = ids.length
    ? await supabase.from("companies").select("distributor_id").in("distributor_id", ids)
    : { data: [] as { distributor_id: string }[] };

  const companyCount = new Map<string, number>();
  for (const row of companyAgg ?? []) {
    companyCount.set(row.distributor_id, (companyCount.get(row.distributor_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Distributors</h1>
        <p className="text-sm text-gray-500">All distributor accounts in the SloanLED network.</p>
      </div>

      <Card>
        <CardHeader title={`${list.length} distributor${list.length === 1 ? "" : "s"}`} />
        {list.length === 0 ? (
          <EmptyState title="No distributors yet" description="Create distributor accounts via Supabase or extend this page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Name</th>
                  <th className="text-left px-5 py-2.5 font-medium">Region</th>
                  <th className="text-left px-5 py-2.5 font-medium">Country</th>
                  <th className="text-left px-5 py-2.5 font-medium">Contact</th>
                  <th className="text-right px-5 py-2.5 font-medium">Signmakers</th>
                  <th className="text-right px-5 py-2.5 font-medium">Active</th>
                  <th className="text-right px-5 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((d) => (
                  <tr key={d.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{d.name}</td>
                    <td className="px-5 py-3 text-gray-700">{d.region || "—"}</td>
                    <td className="px-5 py-3 text-gray-700">{d.country || "—"}</td>
                    <td className="px-5 py-3 text-gray-700">{d.contact_email || "—"}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{companyCount.get(d.id) ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium " +
                          (d.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600")
                        }
                      >
                        {d.is_active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">{formatDate(d.created_at)}</td>
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
