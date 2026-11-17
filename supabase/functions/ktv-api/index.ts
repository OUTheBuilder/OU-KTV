import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const text = (value: unknown, max: number, fallback = "") =>
  typeof value === "string" ? value.trim().slice(0, max) : fallback;

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function youtubeResults(payload: any) {
  const out: any[] = [];
  const sections = payload?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? [];
  for (const section of sections) {
    for (const item of section?.itemSectionRenderer?.contents ?? []) {
      const video = item?.videoRenderer;
      const id = video?.videoId;
      if (!/^[A-Za-z0-9_-]{11}$/.test(id || "")) continue;
      out.push({
        id, youtube_id: id,
        title: text(video?.title?.runs?.map((x: any) => x.text).join(""), 200, "Untitled video"),
        thumb: video?.thumbnail?.thumbnails?.at(-1)?.url ?? `https://i.ytimg.com/vi/${id}/default.jpg`,
        thumbnail: video?.thumbnail?.thumbnails?.at(-1)?.url ?? `https://i.ytimg.com/vi/${id}/default.jpg`,
        channel: text(video?.longBylineText?.runs?.[0]?.text, 100), source: "youtube", type: "song",
      });
    }
  }
  return out.slice(0, 20);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/ktv-api/, "").replace(/^\/api/, "") || "/";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Backend is not configured." }, 503);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    if (path === "/config" && req.method === "GET") {
      const { data, error } = await db.from("ktv_app_config").select("key,value");
      if (error) throw error;
      const cfg = Object.fromEntries((data ?? []).map((x) => [x.key, x.value]));
      return json({
        app_name: cfg.app_name ?? "O|U KTV", app_tagline: cfg.app_tagline ?? "Sing together",
        email_login_enabled: false, default_theme: cfg.default_theme ?? "neonpop",
        default_skin: cfg.default_skin ?? "default", show_search_button: "1",
        show_queue_button: "1", show_popular_button: "1", show_mysongs_button: "1",
        show_live_music_button: "1", buttons: { search: true, queue: true, popular: true, mysongs: true, live_music: true },
        footer: cfg.footer ?? {}, refresh_animation: cfg.refresh_animation ?? "fall",
        video_player: cfg.video_player ?? "youtube",
      });
    }

    if (path === "/login" && req.method === "POST") {
      // Deliberately guest mode. Do not collect credentials until Supabase Auth is integrated.
      const body = await req.json();
      const displayName = text(body.display_name || body.name, 40, "Guest") || "Guest";
      return json({ token: crypto.randomUUID(), email: "", user: { display_name: displayName, test_mode: true } });
    }

    if (path === "/ktvs" && req.method === "POST") {
      const body = await req.json();
      const hostToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      let created = null;
      let insertError = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
        const result = await db.from("ktv_rooms").insert({
          code, name: text(body.name, 80, "Karaoke Room") || "Karaoke Room",
          host_name: text(body.host_name || body.name, 40, "Host") || "Host",
          host_token_hash: await sha256(hostToken),
        }).select("id,code,name,status,host_name,now_playing,is_paused").single();
        if (!result.error) { created = result.data; break; }
        insertError = result.error;
        if (result.error.code !== "23505") break;
      }
      if (!created) throw insertError ?? new Error("Could not create room.");
      return json({ ...created, host_token: hostToken });
    }

    const check = path.match(/^\/ktv\/check\/([A-Za-z0-9_-]+)$/);
    if (check && req.method === "GET") {
      const { data, error } = await db.from("ktv_rooms")
        .select("id,code,name,status,host_name,now_playing,is_paused")
        .eq("code", check[1].toUpperCase()).maybeSingle();
      if (error) throw error;
      return data ? json({ exists: true, ...data }) : json({ exists: false }, 404);
    }

    const action = path.match(/^\/room\/([A-Za-z0-9_-]+)\/action$/);
    if (action && req.method === "POST") {
      const body = await req.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid action." }, 400);
      // The room code is authoritative; never trust a code supplied inside the body.
      const { data, error } = await db.rpc("ktv_apply_action", {
        p_code: action[1].toUpperCase(), p_action: { ...body, host_token: text(body.host_token, 100) },
      });
      if (error) return json({ error: error.message }, error.message.includes("permission") ? 403 : 400);
      return json(data);
    }

    if (path === "/search" && req.method === "GET") {
      const q = text(url.searchParams.get("q"), 120);
      const type = url.searchParams.get("type") || "karaoke";
      if (!q) return json([]);
      if (!["", "karaoke", "music", "live"].includes(type)) return json({ error: "Invalid search type." }, 400);
      const query = type === "karaoke" && !/karaoke/i.test(q) ? `${q} karaoke` :
        type === "live" && !/live/i.test(q) ? `${q} live music video` : q;
      const apiKey = Deno.env.get("YOUTUBE_API_KEY");
      if (apiKey) {
        const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
        endpoint.search = new URLSearchParams({ q: query, type: "video", key: apiKey, maxResults: "20", part: "snippet" }).toString();
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return json({ error: "YouTube search is temporarily unavailable." }, 502);
        const result = await response.json();
        return json((result.items ?? []).flatMap((item: any) => {
          const id = item?.id?.videoId;
          if (!/^[A-Za-z0-9_-]{11}$/.test(id || "")) return [];
          const thumb = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${id}/default.jpg`;
          return [{ id, youtube_id: id, title: text(item.snippet?.title, 200, "Untitled video"), thumb, thumbnail: thumb, channel: text(item.snippet?.channelTitle, 100), source: "youtube", type: "song" }];
        }));
      }
      // YouTube's public web search provides a no-key fallback; no video is embedded or downloaded here.
      const response = await fetch("https://www.youtube.com/youtubei/v1/search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20240101.00.00" } }, query }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return json({ error: "YouTube search is temporarily unavailable." }, 502);
      return json(youtubeResults(await response.json()));
    }

    if (path === "/popular" && req.method === "GET") {
      const query = "popular karaoke songs";
      const apiKey = Deno.env.get("YOUTUBE_API_KEY");
      if (apiKey) {
        const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
        endpoint.search = new URLSearchParams({ q: query, type: "video", key: apiKey, maxResults: "20", part: "snippet" }).toString();
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          const result = await response.json();
          return json((result.items ?? []).flatMap((item: any) => {
            const id = item?.id?.videoId;
            if (!/^[A-Za-z0-9_-]{11}$/.test(id || "")) return [];
            const thumb = item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/default.jpg`;
            return [{ id, youtube_id: id, title: text(item.snippet?.title, 200), thumb, thumbnail: thumb, channel: text(item.snippet?.channelTitle, 100), source: "youtube", type: "song" }];
          }));
        }
      }
      const response = await fetch("https://www.youtube.com/youtubei/v1/search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20240101.00.00" } }, query }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return json([]);
      return json(youtubeResults(await response.json()));
    }

    return json({ error: "Endpoint not implemented yet", path }, 404);
  } catch (error) {
    console.error("ktv-api error", error);
    return json({ error: error instanceof Error ? error.message : "Server error" }, 500);
  }
});
