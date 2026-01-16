"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnKey, RetroSnapshot, Note } from "@/lib/types";
import Timer from "@/components/Timer";
import NoteCard from "@/components/NoteCard";
import { getPusherClient } from "@/lib/pusher";
import { AVATAR_LIST } from "@/lib/avatars";
import TenorGifPicker from "@/components/TenorGifPicker";
// simple id generator for client
function generateId(): string {
  try {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch { }
  return Math.random().toString(36).slice(2);
}

type Props = {
  initial: RetroSnapshot;
};

const DURATIONS = [10, 15, 20] as const;

export default function RetroBoard({ initial }: Props) {
  const [snapshot, setSnapshot] = useState<RetroSnapshot>(initial);
  const [userId, setUserId] = useState<string>("");
  const [userProfile, setUserProfile] = useState<{ name: string; avatar: string } | null>(null);
  const [duration, setDuration] = useState<number>(15);
  const remainingVotes = useMemo(() => {
    const used = snapshot.retro.userVotes[userId]?.length ?? 0;
    return Math.max(0, 6 - used);
  }, [snapshot, userId]);

  // user persistence
  useEffect(() => {
    const key = "retro_user_id";
    let storedId = localStorage.getItem(key);
    if (!storedId) {
      storedId = generateId();
      localStorage.setItem(key, storedId);
    }
    setUserId(storedId);

    const profileKey = "retro_user_profile"; // stores JSON { name, avatar }
    const storedProfile = localStorage.getItem(profileKey);
    if (storedProfile) {
      try {
        const p = JSON.parse(storedProfile);
        if (p.name && p.avatar) {
          setUserProfile(p);
        }
      } catch { }
    }
  }, []);

  // timer for UI updates
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // pusher subscription
  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(snapshot.retro.id);
    channel.bind("state", (s: RetroSnapshot) => {
      setSnapshot(s);
    });

    return () => {
      channel.unbind("state");
      pusher.unsubscribe(snapshot.retro.id);
    };
  }, [snapshot.retro.id]);

  // DERIVE PHASE LOCALLY
  const currentPhase = useMemo(() => {
    // If we have a server snapshot that says "ideas" (time ended), respect it?
    // Actually, trust the local calculation based on startTime/duration for immediate updates.
    // If not started, use server phase (planning)
    if (!snapshot.retro.startTime || !snapshot.retro.durationMinutes) {
      return "planning";
    }
    const endTime = snapshot.retro.startTime + snapshot.retro.durationMinutes * 60_000;
    const remainingMs = endTime - now;

    // < 0 => ideas
    if (remainingMs <= 0) return "ideas";
    // <= 5 min => voting
    if (remainingMs <= 5 * 60_000) return "voting";
    // else => writing
    return "writing";
  }, [snapshot.retro.startTime, snapshot.retro.durationMinutes, now]);

  const canAddToIdeas = currentPhase === "ideas";
  const canVote = currentPhase === "voting";
  const showBlur = currentPhase === "writing";

  const postAction = async (action: string, payload: any) => {
    try {
      await fetch(`/api/pusher/event?retroId=${snapshot.retro.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      });
    } catch (e) {
      console.error("Error posting action", e);
    }
  };

  const handleStart = useCallback(() => {
    postAction("startRetro", {
      durationMinutes: duration,
      starterUserId: userId
    });
  }, [snapshot.retro.id, duration, userId]);

  const handleAddNote = useCallback(
    (column: ColumnKey, text: string) => {
      const t = text.trim();
      if (!t) return;
      postAction("addNote", {
        column,
        text: t,
        authorId: userId,
        authorName: userProfile?.name || undefined
      });
    },
    [snapshot.retro.id, userId, userProfile?.name]
  );

  const handleVote = useCallback(
    (noteId: string) => {
      postAction("toggleVote", {
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
      {(!userProfile || !snapshot.retro.users?.[userId]) && (
        <JoinModal
          retroId={snapshot.retro.id}
          userId={userId}
          existingUsers={Object.values(snapshot.retro.users || {})}
          onJoin={(profile) => {
            setUserProfile(profile);
            localStorage.setItem("retro_user_profile", JSON.stringify(profile));
            // trigger server join
            postAction("joinRetro", { userProfile: { ...profile, id: userId } });
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
            {/* Connected Users */}
            <div className="flex -space-x-2">
              {Object.values(snapshot.retro.users || {}).map((u) => (
                <div key={u.id} className="group relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white bg-gray-100 text-lg shadow-sm">
                    {u.avatar}
                  </div>
                  <div className="absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-black px-2 py-1 text-xs text-white group-hover:block whitespace-nowrap z-10">
                    {u.name}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                navigator.share ? navigator.share({ url: window.location.href }) : navigator.clipboard.writeText(window.location.href).then(() => alert("Link copiado!"));
              }}
              className="rounded bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
            >
              Compartir
            </button>
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
          userName={userProfile?.name || ""}
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
          userName={userProfile?.name || ""}
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
          userName={userProfile?.name || ""}
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
            authorName={n.authorName ?? (n.authorId === userId ? (userName || "yo") : "anónimo")}
            onVote={() => onVote(n.id)}
          />
        ))}
        {notes.length === 0 && <div className="text-sm text-gray-400">Sin notas todavía</div>}
      </div>
    </div>
  );
}

function JoinModal({
  retroId,
  userId,
  existingUsers,
  onJoin
}: {
  retroId: string;
  userId: string;
  existingUsers: any[];
  onJoin: (p: { name: string; avatar: string }) => void;
}) {
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [error, setError] = useState("");

  const takenAvatars = new Set(existingUsers.filter(u => u.id !== userId).map(u => u.avatar));

  const handleJoin = async () => {
    if (!name.trim() || !selectedAvatar) return;
    // optimistic local check
    if (takenAvatars.has(selectedAvatar)) {
      setError("Este avatar ya está en uso, elige otro.");
      return;
    }
    setError("");
    onJoin({ name: name.trim(), avatar: selectedAvatar });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="mb-2 text-xl font-bold text-gray-900">Únete a la Retro</h3>
        <p className="mb-6 text-sm text-gray-500">
          Elige tu avatar y nombre para que el equipo te reconozca.
        </p>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">Elige un Avatar</label>
          <div className="grid grid-cols-5 gap-3 sm:grid-cols-8">
            {AVATAR_LIST.map((av) => {
              const isTaken = takenAvatars.has(av.id);
              const isSelected = selectedAvatar === av.id;
              return (
                <button
                  key={av.id}
                  onClick={() => !isTaken && setSelectedAvatar(av.id)}
                  disabled={isTaken}
                  className={`
                    flex aspect-square items-center justify-center rounded-lg text-2xl transition-all
                    ${isSelected ? "bg-blue-100 ring-2 ring-blue-500 scale-110" : "bg-gray-50 hover:bg-gray-100"}
                    ${isTaken ? "cursor-not-allowed opacity-30 grayscale" : "cursor-pointer"}
                  `}
                  title={isTaken ? "Ya en uso" : av.label || "Seleccionar"}
                >
                  {av.id}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">Tu Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Miguel, Ana, ..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={!name.trim() || !selectedAvatar}
          className="w-full rounded-lg bg-black py-2.5 font-semibold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Entrar a la Retro
        </button>
      </div>
    </div>
  );
}

