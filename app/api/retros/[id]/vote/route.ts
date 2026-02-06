import { NextRequest, NextResponse } from "next/server";
import { addVote, getSnapshot, removeVote } from "@/lib/store";
import { z } from "zod";

const Schema = z.object({
  noteId: z.string().min(1),
  userId: z.string().min(1),
  op: z.enum(["add", "remove"]).default("add")
});

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { noteId, userId, op } = parsed.data;
  const result =
    op === "remove"
      ? await removeVote({ retroId: ctx.params.id, noteId, userId })
      : await addVote({ retroId: ctx.params.id, noteId, userId });
  if (!result.ok && result.reason === "NOT_FOUND") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!result.ok && result.reason === "LIMIT") {
    return NextResponse.json({ error: "Vote limit reached" }, { status: 400 });
  }
  return NextResponse.json(await getSnapshot(ctx.params.id));
}


