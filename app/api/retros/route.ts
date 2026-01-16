import { NextRequest, NextResponse } from "next/server";
import { createRetro, listRetros, getSnapshot } from "@/lib/store";
import { z } from "zod";

export async function GET() {
  const retros = await listRetros();
  const now = Date.now();
  const snapshots = (await Promise.all(retros.map((r) => getSnapshot(r.id, now)))).filter(Boolean) as any[];
  return NextResponse.json(
    snapshots
      .map((s) => ({
        id: s!.retro.id,
        name: s!.retro.name,
        team: s!.retro.team,
        dateISO: s!.retro.dateISO,
        phase: s!.phase
      })),
    { status: 200 }
  );
}

const CreateSchema = z.object({
  team: z.string().min(1),
  dateISO: z.string().min(1),
  name: z.string().optional()
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const retro = await createRetro(parsed.data);
  return NextResponse.json({ id: retro.id, name: retro.name }, { status: 201 });
}


