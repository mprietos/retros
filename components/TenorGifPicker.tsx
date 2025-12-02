"use client";
import React, { useEffect, useMemo, useState } from "react";

type GifItem = { id: string; url: string; dims?: [number, number] };

export default function TenorGifPicker({
  onSelect,
  onClose
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<GifItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const endpoint = q.trim()
          ? `/api/tenor/search?q=${encodeURIComponent(q.trim())}`
          : `/api/tenor/trending`;
        const r = await fetch(endpoint);
        const data = await r.json();
        if (!cancelled) {
          setItems((data.results || []).slice(0, 24));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-3xl flex-col gap-3 rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Buscar GIF en Tenor</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">
            Cerrar
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar (trending si vacío)"
          className="rounded border border-gray-300 px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded bg-gray-100" />
            ))}
          {!loading &&
            items.map((it) => (
              <button
                key={it.id}
                onClick={() => onSelect(it.url)}
                className="group relative overflow-hidden rounded border border-gray-200"
                title="Seleccionar GIF"
              >
                <img src={it.url} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 hidden items-center justify-center bg-black/30 text-white group-hover:flex">
                  Usar
                </div>
              </button>
            ))}
        </div>
        {!loading && items.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">Sin resultados</div>
        )}
      </div>
    </div>
  );
}


