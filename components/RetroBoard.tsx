"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnKey, RetroSnapshot, Note } from "@/lib/types";
import Timer from "@/components/Timer";
import NoteCard from "@/components/NoteCard";
import { getSocket } from "@/lib/socketClient";
import TenorGifPicker from "@/components/TenorGifPicker";
// simple id generator for client
function generateId(): string {
  try {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2);
}

type Props = {
  initial: RetroSnapshot;
};

const DURATIONS = [10, 15, 20] as const;

export default function RetroBoard({ initial }: Props) {
  const [snapshot, setSnapshot] = useState<RetroSnapshot>(initial);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [duration, setDuration] = useState<number>(15);
  const remainingVotes = useMemo(() => {
    const used = snapshot.retro.userVotes[userId]?.length ?? 0;
    return Math.max(0, 6 - used);
  }, [snapshot, userId]);

  // user id persistence
  useEffect(() => {
    const key = "retro_user_id";
    const existing = localStorage.getItem(key);
    if (existing) {
      setUserId(existing);
    } else {
      const created = generateId();
      localStorage.setItem(key, created);
      setUserId(created);
    }
    const nameKey = "retro_user_name";
    const n = localStorage.getItem(nameKey);
    if (n) setUserName(n);
    // capture name from query string if present (?u=...)
    try {
      const sp = new URLSearchParams(window.location.search);
      const u = sp.get("u");
      if (u && u.trim()) {
        localStorage.setItem(nameKey, u.trim());
        setUserName(u.trim());
      }
    } catch {}
  }, []);

  // socket join and listeners
  useEffect(() => {
    const socket = getSocket();
    socket.emit("join", { retroId: snapshot.retro.id });
    const onState = (s: RetroSnapshot) => setSnapshot(s);
    socket.on("state", onState);
    return () => {
      socket.off("state", onState);
    };
  }, [snapshot.retro.id]);

  const canAddToIdeas = snapshot.phase === "ideas";
  const canVote = snapshot.phase === "voting";
  const showBlur = snapshot.phase === "writing";

  const handleStart = useCallback(() => {
    const socket = getSocket();
    socket.emit("startRetro", {
      retroId: snapshot.retro.id,
      durationMinutes: duration,
      starterUserId: userId
    });
  }, [snapshot.retro.id, duration, userId]);

  const handleAddNote = useCallback(
    (column: ColumnKey, text: string) => {
      const t = text.trim();
      if (!t) return;
      const socket = getSocket();
      socket.emit("addNote", {
        retroId: snapshot.retro.id,
        column,
        text: t,
        authorId: userId,
        authorName: userName || undefined
      });
    },
    [snapshot.retro.id, userId, userName]
  );

  const handleVote = useCallback(
    (noteId: string) => {
      const socket = getSocket();
      socket.emit("toggleVote", {
        retroId: snapshot.retro.id,
        noteId,
        userId
      });
    },
    [snapshot.retro.id, userId]
  );

  const grouped = useMemo(() => {
    const by: Record<ColumnKey, typeof snapshot.retro.notes> = { good: [], bad: [], ideas: [] };
    for (const n of snapshot.retro.notes) {
      by[n.column].push(n);
    }
    const sortByVotes = (a: Note, b: Note) => (snapshot.voteCounts[b.id] || 0) - (snapshot.voteCounts[a.id] || 0);
    const sortByTime = (a: Note, b: Note) => a.createdAt - b.createdAt;
    const sorter = snapshot.phase === "voting" || snapshot.phase === "ideas" ? sortByVotes : sortByTime;
    by.good.sort(sorter);
    by.bad.sort(sorter);
    by.ideas.sort(sorter);
    return by;
  }, [snapshot]);

  return (
    <div className="flex flex-col gap-4">
      {!userName && (
        <NameOverlay
          onSave={(name) => {
            const v = name.trim();
            if (!v) return;
            localStorage.setItem("retro_user_name", v);
            setUserName(v);
          }}
        />
      )}
      <div className="flex flex-col gap-2 rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Retro: {snapshot.retro.name}</h1>
            <div className="text-sm text-gray-600">
              Equipo: <span className="font-medium">{snapshot.retro.team}</span> • Fecha: {snapshot.retro.dateISO}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-gray-600">Hola</span>
              <span className="rounded bg-gray-100 px-2 py-1 text-sm font-medium">{userName || "anónimo"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Duración</span>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                disabled={!!snapshot.retro.startTime}
                className="rounded border border-gray-300 px-2 py-1"
                aria-label="Duración"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}m
                  </option>
                ))}
              </select>
              {!snapshot.retro.startTime && (
                <button
                  onClick={handleStart}
                  className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700"
                >
                  Start
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Tiempo</span>
              <Timer endTime={snapshot.endTime} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Fase</span>
              <span className="rounded bg-gray-100 px-2 py-1 text-sm font-medium capitalize">{snapshot.phase}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Votos restantes</span>
              <span className="rounded bg-blue-100 px-2 py-1 text-sm font-bold text-blue-800">{remainingVotes}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column
          title="Cosas que fueron bien, ¡somos top!"
          color="good"
          notes={grouped.good}
          voteCounts={snapshot.voteCounts}
          showBlur={showBlur}
          userId={userId}
          userName={userName}
          canVote={canVote}
          canAdd
          onAdd={(text) => handleAddNote("good", text)}
          onVote={handleVote}
        />
        <Column
          title="¿Algo que no ha ido del todo bien?"
          color="bad"
          notes={grouped.bad}
          voteCounts={snapshot.voteCounts}
          showBlur={showBlur}
          userId={userId}
          userName={userName}
          canVote={canVote}
          canAdd
          onAdd={(text) => handleAddNote("bad", text)}
          onVote={handleVote}
        />
        <Column
          title="¿Tienes alguna idea que puede ser interesante?"
          color="idea"
          notes={grouped.ideas}
          voteCounts={snapshot.voteCounts}
          showBlur={false}
          userId={userId}
          userName={userName}
          canVote={false}
          canAdd={canAddToIdeas}
          addDisabledHint={!canAddToIdeas ? "Se habilita al terminar el tiempo" : undefined}
          onAdd={(text) => handleAddNote("ideas", text)}
          onVote={handleVote}
        />
      </div>
    </div>
  );
}

function Column({
  title,
  color,
  notes,
  voteCounts,
  showBlur,
  userId,
  userName,
  canVote,
  canAdd,
  addDisabledHint,
  onAdd,
  onVote
}: {
  title: string;
  color: "good" | "bad" | "idea";
  notes: Array<{ id: string; text: string; authorId: string; authorName?: string }>;
  voteCounts: Record<string, number>;
  showBlur: boolean;
  userId: string;
  userName: string;
  canVote: boolean;
  canAdd: boolean;
  addDisabledHint?: string;
  onAdd: (text: string) => void;
  onVote: (noteId: string) => void;
}) {
  const [text, setText] = useState("");
  const [showGif, setShowGif] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(text);
    setText("");
  };
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow">
      <h2
        className={
          color === "good"
            ? "text-lg font-semibold text-good"
            : color === "bad"
            ? "text-lg font-semibold text-bad"
            : "text-lg font-semibold text-idea"
        }
      >
        {title}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!canAdd}
          placeholder={addDisabledHint ?? "Escribe aquí... (puedes pegar una URL .gif)"}
          className="min-h-[80px] rounded border border-gray-300 p-2 outline-none disabled:bg-gray-100"
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => setShowGif(true)}
            className="rounded border border-blue-200 px-2 py-1 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            Añadir GIF
          </button>
          <button
            type="submit"
            disabled={!canAdd || !text.trim()}
            className="rounded bg-gray-900 px-3 py-1.5 text-white disabled:opacity-50"
          >
            Añadir
          </button>
        </div>
      </form>
      {showGif && (
        <TenorGifPicker
          onSelect={(url) => {
            setText((t) => (t ? `${t}\n${url}` : url));
            setShowGif(false);
          }}
          onClose={() => setShowGif(false)}
        />
      )}
      <div className="flex flex-col gap-2">
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            text={n.text}
            blurred={showBlur && n.authorId !== userId}
            votes={voteCounts[n.id] || 0}
            canVote={canVote}
            authorName={n.authorName ?? (n.authorId === userId ? userName : "anónimo")}
            onVote={() => onVote(n.id)}
          />
        ))}
        {notes.length === 0 && <div className="text-sm text-gray-400">Sin notas todavía</div>}
      </div>
    </div>
  );
}

function NameOverlay({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState<string>("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <h3 className="mb-2 text-lg font-semibold">Tu nombre</h3>
        <p className="mb-3 text-sm text-gray-600">
          Para entrar a la retro, indica tu nombre o apodo.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onSave(name)}
            disabled={!name.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}

