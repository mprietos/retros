
import { getSnapshot } from "@/lib/store";
import RetroBoard from "@/components/RetroBoard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RetroPage({ params }: { params: { id: string } }) {
  const snap = await getSnapshot(params.id);
  if (!snap) return notFound();
  return <RetroBoard initial={snap} />;
}


