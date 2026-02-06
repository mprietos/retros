
import { getSnapshot } from "@/lib/store";
import RetroBoard from "@/components/RetroBoard";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RetroPage({ params }: { params: { id: string } }) {
  try {
    const snap = await getSnapshot(params.id);
    if (!snap) return notFound();

    if (snap.retro.finished) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8">
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-6 text-center">
            <h1 className="mb-2 text-xl font-bold text-yellow-800">Retro finalizada</h1>
            <p className="text-yellow-700">Esta retro ha sido cerrada y ya no se puede acceder.</p>
          </div>
          <Link href="/" className="rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800">
            Volver al inicio
          </Link>
        </div>
      );
    }

    return <RetroBoard initial={snap} />;
  } catch (error) {
    console.error("Error in RetroPage:", error);
    throw error; // Re-throw to show error page, but now we have logs
  }
}
