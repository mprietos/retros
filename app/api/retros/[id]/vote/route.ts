import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, toggleVote } from "@/lib/store";
import { z } from "zod";

const Schema = z.object({
  noteId: z.string().min(1),
  userId: z.string().min(1)
});

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const result = await toggleVote({
    retroId: ctx.params.id,
    noteId: parsed.data.noteId,
    userId: parsed.data.userId
  });
  if (!result.ok && result.reason === "NOT_FOUND") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!result.ok && result.reason === "LIMIT") {
    return NextResponse.json({ error: "Vote limit reached" }, { status: 400 });
  }
  return NextResponse.json(await getSnapshot(ctx.params.id));
}


