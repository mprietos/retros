import { NextResponse } from "next/server";
import { deleteRetro } from "@/lib/store";

export async function POST(req: Request) {
  const { retroId } = await req.json();
  if (!retroId || typeof retroId !== "string") {
    return NextResponse.json({ error: "Missing retroId" }, { status: 400 });
  }

  const result = await deleteRetro(retroId);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
