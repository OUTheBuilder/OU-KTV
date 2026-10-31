import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/ktv-api/, "").replace(/^\/api/, "") || "/";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    if (path === "/config" && req.method === "GET") {
      const { data, error } = await db.from("ktv_app_config").select("key,value");
      if (error) throw error;
      const config = Object.fromEntries((data ?? []).map((x) => [x.key, x.value]));
      return json({
        app_name: config.app_name ?? "O|U KTV",
        app_tagline: config.app_tagline ?? "Sing together",
        email_login_enabled: false,
        default_theme: config.default_theme ?? "neonpop",
        default_skin: config.default_skin ?? "default",
        show_search_button: "1", show_queue_button: "1", show_popular_button: "1",
        show_mysongs_button: "1", show_live_music_button: "0",
      });
    }

    if (path === "/login" && req.method === "POST") {
      const body = await req.json();
      const displayName = String(body.display_name || body.name || "Guest").slice(0, 40);
      return json({ token: crypto.randomUUID(), email: body.email || "", user: { display_name: displayName, test_mode: true } });
    }

    if (path === "/ktvs" && req.method === "POST") {
      const body = await req.json();
      const code = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
      const { data, error } = await db.from("ktv_rooms").insert({
        code, name: String(body.name || "Karaoke Room").slice(0, 80),
        host_name: String(body.host_name || body.name || "Host").slice(0, 40),
      }).select().single();
      if (error) throw error;
      return json({ ...data, code });
    }

    const check = path.match(/^\/ktv\/check\/([A-Za-z0-9_-]+)$/);
    if (check && req.method === "GET") {
      const { data, error } = await db.from("ktv_rooms").select("id,code,name,status,host_name").eq("code", check[1].toUpperCase()).maybeSingle();
      if (error) throw error;
      return data ? json({ exists: true, ...data }) : json({ exists: false }, 404);
    }

    const action = path.match(/^\/room\/([A-Za-z0-9_-]+)\/action$/);
    if (action && req.method === "POST") {
      const body = await req.json();
      const { data, error } = await db.rpc("ktv_apply_action", { p_code: action[1].toUpperCase(), p_action: body });
      if (error) throw error;
      return json(data);
    }

    // Client expects arrays. Empty arrays intentionally activate its built-in
    // popular-song suggestions; live search is enabled after a server-side
    // YouTube Data API key is configured.
    if (path === "/popular" && req.method === "GET") return json([]);
    if (path === "/search" && req.method === "GET") return json([]);

    return json({ error: "Endpoint not implemented yet", path }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Server error" }, 400);
  }
});
