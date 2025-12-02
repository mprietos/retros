import { getSnapshot } from "@/lib/store";
import RetroBoard from "@/components/RetroBoard";
import { notFound } from "next/navigation";

export default function RetroPage({ params }: { params: { id: string } }) {
  const snap = getSnapshot(params.id);
  if (!snap) return notFound();
  return <RetroBoard initial={snap} />;
}


