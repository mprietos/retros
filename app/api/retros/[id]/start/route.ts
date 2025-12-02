import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, startRetro } from "@/lib/store";
import { z } from "zod";

const Schema = z.object({
  durationMinutes: z.number().int().min(5).max(60),
  starterUserId: z.string().min(1)
});

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const retro = startRetro(ctx.params.id, parsed.data.durationMinutes, parsed.data.starterUserId);
  if (!retro) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(getSnapshot(ctx.params.id));
}


