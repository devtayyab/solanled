import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export default async function DocumentActivityPage() {
  await getSessionProfile();
  const supabase = await createClient();

  const { data: views } = await supabase
    .from("document_views")
    .select("id, viewed_at, source, documents(title, category, language), profiles(full_name), companies(name)")
    .order("viewed_at", { ascending: false })
    .limit(200);

  // Document leaderboard: count views per document (in-memory; OK for the
  // dataset volumes expected on this portal).
  const counts = new Map<string, { title: string; category: string; views: number }>();
  for (const v of (views ?? []) as any[]) {
    const key = v.documents?.title ?? "Unknown";
    const prev = counts.get(key) ?? { title: key, category: v.documents?.category ?? "general", views: 0 };
    prev.views += 1;
    counts.set(key, prev);
  }
  const leaderboard = [...counts.values()].sort((a, b) => b.views - a.views).slice(0, 10);

  const list = (views ?? []) as any[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Document activity</h1>
        <p className="text-sm text-gray-500">Which documents your signmakers are reading.</p>
      </div>

      <Card>
        <CardHeader title="Top documents" subtitle="Most viewed (last 200 events)" />
        {leaderboard.length === 0 ? (
          <EmptyState title="No views yet" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {leaderboard.map((d) => (
              <li key={d.title} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{d.title}</div>
                  <div className="text-xs text-gray-500">{d.category}</div>
                </div>
                <div className="text-sm font-semibold text-brand-700">{d.views}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent views" />
        {list.length === 0 ? (
          <EmptyState title="No views yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Document</th>
                  <th className="text-left px-5 py-2.5 font-medium">Viewer</th>
                  <th className="text-left px-5 py-2.5 font-medium">Signmaker</th>
                  <th className="text-left px-5 py-2.5 font-medium">Source</th>
                  <th className="text-right px-5 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((v) => (
                  <tr key={v.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {v.documents?.title ?? "—"}
                      <div className="text-xs text-gray-500">
                        {v.documents?.category ?? "general"} · {v.documents?.language?.toUpperCase() ?? "EN"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{v.profiles?.full_name ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-700">{v.companies?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{v.source ?? "mobile"}</td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500">{formatDateTime(v.viewed_at)}</td>
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
