"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteRetroButton({ retroId }: { retroId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("¿Seguro que quieres borrar esta retro? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/retros/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retroId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="shrink-0 rounded bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      {deleting ? "Borrando..." : "Borrar"}
    </button>
  );
}
