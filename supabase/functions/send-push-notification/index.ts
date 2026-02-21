import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PushPayload {
  user_ids?: string[];
  company_id?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: PushPayload = await req.json();
    const { title, body, data = {}, user_ids, company_id } = payload;

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetUserIds: string[] = user_ids || [];

    if (company_id && !user_ids?.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", company_id);
      targetUserIds = (profiles || []).map((p: any) => p.id);
    }

    if (!targetUserIds.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No target users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .in("user_id", targetUserIds);

    if (!tokens?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No push tokens found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expoPushTokens = tokens
      .filter((t: any) => t.token.startsWith("ExponentPushToken"))
      .map((t: any) => t.token);

    if (!expoPushTokens.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No Expo push tokens found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = expoPushTokens.map((token: string) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
      priority: "high",
    }));

    const CHUNK_SIZE = 100;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });

      if (response.ok) {
        const result = await response.json();
        const results: any[] = result.data || [];
        totalSent += results.filter((r: any) => r.status === "ok").length;
        totalFailed += results.filter((r: any) => r.status !== "ok").length;
      }
    }

    return new Response(
      JSON.stringify({
        sent: totalSent,
        failed: totalFailed,
        total: expoPushTokens.length,
        message: `Sent ${totalSent} of ${expoPushTokens.length} notifications`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
