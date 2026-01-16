import Link from "next/link";
import { listRetros, getSnapshot } from "@/lib/store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = Date.now();
  const retros = await listRetros();
  const snapshots = (await Promise.all(retros.map((r) => getSnapshot(r.id, now)))).filter(Boolean) as any[];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg bg-white p-4 shadow">
        <h1 className="mb-2 text-2xl font-bold">Retros de Scrum</h1>
        <p className="text-gray-600">Entra en una retro abierta por nombre o crea una nueva.</p>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <EnterExisting />
        <CreateNew />
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold">Retros abiertas</h2>
        <ul className="flex flex-col gap-2">
          {snapshots.filter((s) => s.phase !== "ideas").map((s) => (
            <li key={s.retro.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
              <div className="flex flex-col">
                <span className="font-medium">{s.retro.name}</span>
                <span className="text-sm text-gray-600">
                  Equipo: {s.retro.team} • Fecha: {s.retro.dateISO} • Fase: <span className="capitalize">{s.phase}</span>
                </span>
              </div>
              <Link
                href={`/retro/${s.retro.id}`}
                className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
              >
                Entrar
              </Link>
            </li>
          ))}
          {snapshots.filter((s) => s.phase !== "ideas").length === 0 && (
            <li className="text-sm text-gray-500">No hay retros abiertas.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function EnterExisting() {
  return (
    <form
      action={async (formData) => {
        "use server";
        const name = String(formData.get("name") || "").toLowerCase();
        const personName = String(formData.get("personName") || "").trim();
        const { getRetroIdByName } = await import("@/lib/store");
        const id = await getRetroIdByName(name);
        if (!id) {
          redirect(`/?missing=1`);
        }
        const u = encodeURIComponent(personName);
        redirect(`/retro/${id}?u=${u}`);
      }}
      className="flex flex-col gap-2 rounded-lg bg-white p-4 shadow"
    >
      <h2 className="text-lg font-semibold">Entrar a una retro</h2>
      <label className="text-sm text-gray-700" htmlFor="retroName">Nombre</label>
      <input
        required
        id="retroName"
        name="name"
        placeholder="ej: equipo-2025-11-17"
        className="rounded border border-gray-300 px-3 py-2"
      />
      <label className="text-sm text-gray-700" htmlFor="personNameEnter">Tu nombre</label>
      <input
        required
        id="personNameEnter"
        name="personName"
        placeholder="Tu nombre y/o apodo"
        className="rounded border border-gray-300 px-3 py-2"
      />
      <button type="submit" className="mt-2 w-fit rounded bg-gray-900 px-3 py-2 text-white">
        Entrar
      </button>
    </form>
  );
}

function CreateNew() {
  return (
    <form
      action={async (formData) => {
        "use server";
        const team = String(formData.get("team") || "");
        const dateISO = String(formData.get("dateISO") || "");
        const name = String(formData.get("name") || "");
        const personName = String(formData.get("personName") || "").trim();
        const { createRetro } = await import("@/lib/store");
        const retro = await createRetro({ team, dateISO, name: name || undefined });
        const u = encodeURIComponent(personName);
        redirect(`/retro/${retro.id}?u=${u}`);
      }}
      className="flex flex-col gap-2 rounded-lg bg-white p-4 shadow"
    >
      <h2 className="text-lg font-semibold">Crear nueva retro</h2>
      <label className="text-sm text-gray-700" htmlFor="team">Equipo</label>
      <input id="team" required name="team" placeholder="Nombre del equipo" className="rounded border border-gray-300 px-3 py-2" />
      <label className="text-sm text-gray-700" htmlFor="dateISO">Fecha</label>
      <input id="dateISO" required type="date" name="dateISO" className="rounded border border-gray-300 px-3 py-2" />
      <label className="text-sm text-gray-700" htmlFor="retroCustomName">Nombre (opcional)</label>
      <input id="retroCustomName" name="name" placeholder="Por defecto: equipo-fecha" className="rounded border border-gray-300 px-3 py-2" />
      <label className="text-sm text-gray-700" htmlFor="personNameCreate">Tu nombre</label>
      <input
        id="personNameCreate"
        required
        name="personName"
        placeholder="Tu nombre y/o apodo"
        className="rounded border border-gray-300 px-3 py-2"
      />
      <button type="submit" className="mt-2 w-fit rounded bg-green-600 px-3 py-2 text-white">
        Crear
      </button>
    </form>
  );
}


