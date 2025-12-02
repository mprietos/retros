import { NextRequest, NextResponse } from "next/server";
import { addNote, getSnapshot } from "@/lib/store";
import { z } from "zod";

const Schema = z.object({
  column: z.enum(["good", "bad", "ideas"]),
  text: z.string().min(1),
  authorId: z.string().min(1),
  authorName: z.string().optional()
});

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const note = addNote({
    retroId: ctx.params.id,
    column: parsed.data.column,
    text: parsed.data.text,
    authorId: parsed.data.authorId,
    authorName: parsed.data.authorName
  });
  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(getSnapshot(ctx.params.id));
}


