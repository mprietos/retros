import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest) {
  const key = process.env.TENOR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "TENOR_API_KEY not configured" }, { status: 500 });
  }
  const url = new URL("https://tenor.googleapis.com/v2/featured");
  url.searchParams.set("key", key);
  url.searchParams.set("limit", "24");
  url.searchParams.set("client_key", "retros");
  url.searchParams.set("media_filter", "gif");
  const r = await fetch(url.toString());
  if (!r.ok) {
    return NextResponse.json({ error: "Tenor request failed" }, { status: 502 });
  }
  const data = await r.json();
  const results = (data.results || []).map((it: any) => {
    const fm = it.media_formats || {};
    const gif = fm.gif || fm.mediumgif || fm.tinygif || null;
    return {
      id: it.id,
      url: gif?.url || null,
      dims: gif?.dims || null
    };
  }).filter((x: any) => x.url);
  return NextResponse.json({ results });
}


