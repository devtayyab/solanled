import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, Stat, StatusBadge } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Project } from "@/types/database";

export default async function SignmakerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getSessionProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, country, address, phone, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!company) notFound();

  const [
    { data: projects },
    { data: members },
    { data: docViews },
    { data: aiRequests },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, status, location_address, installed_at, updated_at")
      .eq("company_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, role, language, created_at")
      .eq("company_id", id)
      .order("created_at"),
    supabase
      .from("document_views")
      .select("id, viewed_at, documents(title, category)")
      .eq("company_id", id)
      .order("viewed_at", { ascending: false })
      .limit(25),
    supabase
      .from("ai_request_log")
      .select("id, intent, prompt_preview, created_at")
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const projectList = (projects ?? []) as Pick<
    Project,
    "id" | "title" | "status" | "location_address" | "installed_at" | "updated_at"
  >[];
  const installed = projectList.filter(
    (p) => p.status === "installed" || p.status === "completed",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-500">Signmaker</div>
        <h1 className="text-2xl font-semibold text-gray-900">{company.name}</h1>
        <p className="text-sm text-gray-500">
          {company.address || "—"} · {company.country || "—"} · joined {formatDate(company.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Projects" value={projectList.length} />
        <Stat label="Installed" value={installed} />
        <Stat label="Document views" value={docViews?.length ?? 0} hint="Last 25" />
        <Stat label="Luxa AI requests" value={aiRequests?.length ?? 0} hint="Last 25" />
      </div>

      <Card>
        <CardHeader title="Projects" />
        {projectList.length === 0 ? (
          <EmptyState title="No projects yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Title</th>
                  <th className="text-left px-5 py-2.5 font-medium">Location</th>
                  <th className="text-left px-5 py-2.5 font-medium">Status</th>
                  <th className="text-right px-5 py-2.5 font-medium">Installed</th>
                  <th className="text-right px-5 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projectList.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{p.title}</td>
                    <td className="px-5 py-3 text-gray-700">{p.location_address || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">{formatDate(p.installed_at)}</td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">{formatDateTime(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Document views" />
          {(docViews?.length ?? 0) === 0 ? (
            <EmptyState title="No document views" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {docViews!.map((v: any) => (
                <li key={v.id} className="px-5 py-3">
                  <div className="text-sm font-medium text-gray-900">{v.documents?.title ?? "—"}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {v.documents?.category ?? "general"} · {formatDateTime(v.viewed_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Luxa AI requests" subtitle="Voiceflow assistant activity" />
          {(aiRequests?.length ?? 0) === 0 ? (
            <EmptyState title="No AI requests" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {aiRequests!.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <div className="text-sm font-medium text-gray-900">{r.intent || "Request"}</div>
                  {r.prompt_preview && (
                    <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{r.prompt_preview}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(r.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={`Team (${members?.length ?? 0})`} />
        {(members?.length ?? 0) === 0 ? (
          <EmptyState title="No team members" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {members!.map((m) => (
              <li key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{m.full_name || "Unnamed"}</div>
                  <div className="text-xs text-gray-500">
                    {m.role} · {m.language?.toUpperCase() || "EN"}
                  </div>
                </div>
                <div className="text-xs text-gray-400">joined {formatDate(m.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
