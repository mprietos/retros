import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/store";

export async function GET(_: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const snapshot = getSnapshot(id);
  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}


