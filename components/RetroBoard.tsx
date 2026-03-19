"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColumnKey, RetroSnapshot, Note } from "@/lib/types";
import Timer from "@/components/Timer";
import NoteCard from "@/components/NoteCard";
import { getPusherClient } from "@/lib/pusher";
import { AVATAR_LIST } from "@/lib/avatars";
import TenorGifPicker from "@/components/TenorGifPicker";

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
  const [myNoteTexts, setMyNoteTexts] = useState<Record<string, string>>({});
  const [now, setNow] = useState<number>(() => Date.now());

  // user persistence
  useEffect(() => {
    const key = "retro_user_id";
    let storedId = localStorage.getItem(key);
    if (!storedId) {
      storedId = generateId();
      localStorage.setItem(key, storedId);
    }
    setUserId(storedId);

    const profileKey = "retro_user_profile";
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
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // pusher subscription + polling fallback
  useEffect(() => {
    const retroId = snapshot.retro.id;

    // Pusher real-time
    const pusher = getPusherClient();
    let channel: any = null;
    if (pusher) {
      channel = pusher.subscribe(retroId);
      channel.bind("state", (s: RetroSnapshot) => {
        setSnapshot(s);
      });
    }

    // Polling fallback every 3s (ensures sync even without Pusher)
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/pusher/event?retroId=${retroId}`);
        if (res.ok) {
          const s = await res.json();
          if (s?.retro) setSnapshot(s);
        }
      } catch { }
    }, 3000);

    return () => {
      clearInterval(poll);
      if (channel) {
        channel.unbind("state");
        pusher?.unsubscribe(retroId);
      }
    };
  }, [snapshot.retro.id]);

  // DERIVE PHASE LOCALLY — mirrors computePhase from server
  const currentPhase = useMemo(() => {
    if (!snapshot.retro.startTime || !snapshot.retro.durationMinutes) {
      return "planning";
    }

    if (snapshot.retro.finished) {
      return "finished";
    }

    const computedEndTime = snapshot.retro.startTime + snapshot.retro.durationMinutes * 60_000;
    const endTime = snapshot.retro.endTimeOverride ?? computedEndTime;
    const remainingMs = Math.max(0, endTime - now);
    const fiveMinutesMs = 5 * 60_000;

    if (remainingMs === 0) return "finished";
    if (snapshot.retro.phaseOverride === "voting") return "voting";
    if (snapshot.retro.phaseOverride === "writing") return "writing";
    if (remainingMs <= fiveMinutesMs) return "voting";
    return "writing";
  }, [snapshot.retro.startTime, snapshot.retro.durationMinutes, snapshot.retro.endTimeOverride, snapshot.retro.phaseOverride, snapshot.retro.finished, now]);

  // Clear myNoteTexts when leaving writing phase
  const prevPhaseRef = useRef(currentPhase);
  useEffect(() => {
    if (prevPhaseRef.current === "writing" && currentPhase !== "writing") {
      setMyNoteTexts({});
    }
    prevPhaseRef.current = currentPhase;
  }, [currentPhase]);

  const processedNotes = useMemo(() => {
    return snapshot.retro.notes.map((n) => {
      if (n.authorId === userId && n.text === "" && myNoteTexts[n.id]) {
        return { ...n, text: myNoteTexts[n.id] };
      }
      return n;
    });
  }, [snapshot.retro.notes, userId, myNoteTexts]);

  const remainingVotes = useMemo(() => {
    const used = snapshot.retro.userVotes[userId]?.length ?? 0;
    return Math.max(0, 6 - used);
  }, [snapshot, userId]);

  const myVoteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const userVotes = snapshot.retro.userVotes[userId] || [];
    for (const noteId of userVotes) {
      counts[noteId] = (counts[noteId] || 0) + 1;
    }
    return counts;
  }, [snapshot.retro.userVotes, userId]);

  const grouped = useMemo(() => {
    const by: Record<ColumnKey, typeof processedNotes> = { good: [], bad: [], ideas: [] };
    for (const n of processedNotes) {
      by[n.column].push(n);
    }
    const sortByVotes = (a: Note, b: Note) => (snapshot.voteCounts[b.id] || 0) - (snapshot.voteCounts[a.id] || 0);
    const sortByTime = (a: Note, b: Note) => a.createdAt - b.createdAt;
    const sorter = currentPhase === "voting" || currentPhase === "finished" ? sortByVotes : sortByTime;
    by.good.sort(sorter);
    by.bad.sort(sorter);
    by.ideas.sort(sorter);
    return by;
  }, [processedNotes, snapshot.voteCounts, currentPhase]);

  const isFinished = currentPhase === "finished";
  const isStarted = !!snapshot.retro.startTime;
  const isOwner = !snapshot.retro.starterUserId || snapshot.retro.starterUserId === userId;
  const canVote = currentPhase === "voting";
  const showBlur = currentPhase === "writing";

  const postAction = useCallback(async (action: string, payload: any) => {
    try {
      const res = await fetch(`/api/pusher/event?retroId=${snapshot.retro.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      });
      // Use response snapshot as fallback if Pusher doesn't deliver
      if (res.ok) {
        const data = await res.json();
        if (data.snapshot) {
          setSnapshot(data.snapshot);
        }
      }
    } catch (e) {
      console.error("Error posting action", e);
    }
  }, [snapshot.retro.id]);

  const handleStart = useCallback(() => {
    postAction("startRetro", { durationMinutes: duration, starterUserId: userId });
  }, [postAction, duration, userId]);

  const handleAddNote = useCallback(
    (column: ColumnKey, text: string) => {
      const t = text.trim();
      if (!t) return;
      const noteId = generateId();
      setMyNoteTexts((prev) => ({ ...prev, [noteId]: t }));
      postAction("addNote", { column, text: t, noteId, authorId: userId, authorName: userProfile?.name || undefined });
    },
    [postAction, userId, userProfile?.name]
  );

  const handleAddVote = useCallback(
    (noteId: string) => { postAction("addVote", { noteId, userId }); },
    [postAction, userId]
  );

  const handleRemoveVote = useCallback(
    (noteId: string) => { postAction("removeVote", { noteId, userId }); },
    [postAction, userId]
  );

  const handleAdvanceToVoting = useCallback(() => {
    postAction("setPhaseOverride", { phase: "voting" });
  }, [postAction]);

  const handleEndRetro = useCallback(() => {
    postAction("endRetroEarly", {});
  }, [postAction]);

  const handleFinishRetro = useCallback(() => {
    if (confirm("¿Estás seguro de que quieres finalizar esta retro? Ya no se podrá modificar.")) {
      postAction("finishRetro", {});
    }
  }, [postAction]);

  const handleRemoveActionItem = useCallback(
    (actionItemId: string) => { postAction("removeActionItem", { actionItemId }); },
    [postAction]
  );

  const phaseLabel: Record<string, string> = {
    planning: "Planificando",
    writing: "Escribiendo",
    voting: "Votaciones",
    finished: "Finalizada"
  };

  const phaseColor: Record<string, string> = {
    planning: "bg-gray-100 text-gray-700",
    writing: "bg-blue-100 text-blue-800",
    voting: "bg-amber-100 text-amber-800",
    finished: "bg-green-100 text-green-800"
  };

  const actionItems = snapshot.retro.actionItems || [];
  const canAddActionItems = isFinished && actionItems.length < 2;

  return (
    <div className="flex flex-col gap-4">
      {(!userProfile || !snapshot.retro.users?.[userId]) && !snapshot.retro.finished && (
        <JoinModal
          retroId={snapshot.retro.id}
          userId={userId}
          existingUsers={Object.values(snapshot.retro.users || {})}
          onJoin={(profile) => {
            setUserProfile(profile);
            localStorage.setItem("retro_user_profile", JSON.stringify(profile));
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
            <div className="flex -space-x-2">
              {Object.values(snapshot.retro.users || {}).map((u) => (
                <div key={u.id} className="group relative">
                  <div className="emoji flex h-8 w-8 items-center justify-center rounded-full border border-white bg-gray-100 text-lg shadow-sm">
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
              {!snapshot.retro.startTime && !isFinished && isOwner && (
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
              <span className={`rounded px-2 py-1 text-sm font-medium ${phaseColor[currentPhase] || ""}`}>
                {phaseLabel[currentPhase] || currentPhase}
              </span>
            </div>
            {!isFinished && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Votos restantes</span>
                <span className="rounded bg-blue-100 px-2 py-1 text-sm font-bold text-blue-800">{remainingVotes}</span>
              </div>
            )}
          </div>
        </div>
        {isStarted && !isFinished && isOwner && (
          <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
            {currentPhase === "writing" && (
              <button
                onClick={handleAdvanceToVoting}
                className="rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Pasar a votación
              </button>
            )}
            {currentPhase === "voting" && (
              <button
                onClick={handleEndRetro}
                className="rounded bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Terminar votación
              </button>
            )}
            <button
              onClick={handleFinishRetro}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Finalizar retro
            </button>
          </div>
        )}
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
          canAdd={!isFinished && currentPhase !== "voting"}
          myVoteCounts={myVoteCounts}
          remainingVotes={remainingVotes}
          onAdd={(text) => handleAddNote("good", text)}
          onAddVote={handleAddVote}
          onRemoveVote={handleRemoveVote}
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
          canAdd={!isFinished && currentPhase !== "voting"}
          myVoteCounts={myVoteCounts}
          remainingVotes={remainingVotes}
          onAdd={(text) => handleAddNote("bad", text)}
          onAddVote={handleAddVote}
          onRemoveVote={handleRemoveVote}
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
          canAdd={!isFinished}
          myVoteCounts={myVoteCounts}
          remainingVotes={remainingVotes}
          onAdd={(text) => handleAddNote("ideas", text)}
          onAddVote={handleAddVote}
          onRemoveVote={handleRemoveVote}
        />
      </div>

      {isFinished && (
        <ActionItemsSection
          retroId={snapshot.retro.id}
          actionItems={actionItems}
          notes={snapshot.retro.notes}
          isOwner={isOwner}
          onGenerated={() => {
            fetch(`/api/pusher/event?retroId=${snapshot.retro.id}`)
              .then(r => r.json())
              .then(s => { if (s?.retro) setSnapshot(s); })
              .catch(() => {});
          }}
          onRemove={handleRemoveActionItem}
        />
      )}
    </div>
  );
}

function ActionItemsSection({
  retroId,
  actionItems,
  notes,
  isOwner,
  onGenerated,
  onRemove
}: {
  retroId: string;
  actionItems: Array<{ id: string; text: string; authorName?: string }>;
  notes: Array<{ column: string; text: string }>;
  isOwner: boolean;
  onGenerated: () => void;
  onRemove: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/retros/generate-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retroId })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error generando acciones");
        return;
      }
      onGenerated();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-green-200 bg-green-50 p-6 shadow">
      <h2 className="mb-1 text-xl font-bold text-green-800">Acciones de mejora</h2>
      <p className="mb-4 text-sm text-green-600">
        {actionItems.length > 0
          ? "Acciones generadas por IA basadas en los comentarios de la retro."
          : isOwner
            ? "Genera 2 acciones concretas basadas en los comentarios de la retro usando IA."
            : "El facilitador puede generar acciones de mejora con IA."}
      </p>

      {actionItems.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          {actionItems.map((item, idx) => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg bg-white p-4 shadow-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <p className="flex-1 text-gray-900">{item.text}</p>
              {isOwner && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && actionItems.length === 0 && (
        <button
          onClick={handleGenerate}
          disabled={loading || notes.length === 0}
          className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generando con IA...
            </span>
          ) : (
            "Generar acciones de mejora con IA"
          )}
        </button>
      )}

      {isOwner && actionItems.length > 0 && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Regenerando...
            </span>
          ) : (
            "Regenerar acciones"
          )}
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
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
  myVoteCounts,
  remainingVotes,
  onAdd,
  onAddVote,
  onRemoveVote
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
  myVoteCounts: Record<string, number>;
  remainingVotes: number;
  onAdd: (text: string) => void;
  onAddVote: (noteId: string) => void;
  onRemoveVote: (noteId: string) => void;
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
            myVotes={myVoteCounts[n.id] || 0}
            remainingVotes={remainingVotes}
            onAddVote={() => onAddVote(n.id)}
            onRemoveVote={() => onRemoveVote(n.id)}
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
                    emoji flex aspect-square items-center justify-center rounded-lg text-2xl transition-all
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
