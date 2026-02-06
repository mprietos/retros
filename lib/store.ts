import { randomUUID } from "crypto";
import { Note, Phase, Retro, RetroSnapshot } from "@/lib/types";
import { createClient } from "@vercel/kv";

const MAX_VOTES_PER_USER = 6;

// KV Client
// Ensure environment variables KV_REST_API_URL and KV_REST_API_TOKEN are set
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error("Missing Vercel KV environment variables (KV_REST_API_URL, KV_REST_API_TOKEN). Check your .env.local or Vercel project settings.");
}

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function listRetros(): Promise<Retro[]> {
  const retrosMap = await kv.hgetall<Record<string, Retro>>("retros");
  if (!retrosMap) return [];
  // sort by creation
  return Object.values(retrosMap).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRetroById(id: string): Promise<Retro | undefined> {
  const retro = await kv.hget<Retro>("retros", id);
  return retro || undefined;
}

export async function getRetroIdByName(name: string): Promise<string | undefined> {
  // We can scan or maintain a separate mapping. For simplicity, let's just search the list.
  // In production with many retros, a separate key "retro_names" -> id would be better.
  const retros = await listRetros();
  const found = retros.find((r) => r.name === name.toLowerCase());
  return found?.id;
}

export async function createRetro(params: { name?: string; team: string; dateISO: string }): Promise<Retro> {
  const id = randomUUID();
  const name = (params.name && params.name.trim()) || `${params.team}-${params.dateISO}`.toLowerCase();
  const now = Date.now();

  // Check collision locally (simplified)
  const existingId = await getRetroIdByName(name);
  if (existingId) {
    const existing = await getRetroById(existingId);
    if (existing) return existing;
  }

  const retro: Retro = {
    id,
    name,
    team: params.team,
    dateISO: params.dateISO,
    createdAt: now,
    durationMinutes: null,
    startTime: null,
    starterUserId: null,
    endTimeOverride: null,
    phaseOverride: null,
    revealComments: false,
    finished: false,
    notes: [],

    userVotes: {},
    users: {}
  };

  await kv.hset("retros", { [id]: retro });
  return retro;
}

export async function startRetro(id: string, durationMinutes: number, starterUserId: string): Promise<Retro | undefined> {
  const retro = await getRetroById(id);
  if (!retro) return undefined;
  if (retro.startTime) return retro; // already started

  retro.startTime = Date.now();
  retro.durationMinutes = durationMinutes;
  retro.starterUserId = starterUserId;
  retro.endTimeOverride = null;
  retro.phaseOverride = null;
  retro.revealComments = retro.revealComments ?? false;

  await kv.hset("retros", { [id]: retro });
  return retro;
}

export async function deleteRetro(id: string): Promise<{ ok: boolean; reason?: string }> {
  const retro = await getRetroById(id);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };
  await kv.hdel("retros", id);
  return { ok: true };
}

export async function addNote(params: {
  retroId: string;
  column: Note["column"];
  text: string;
  noteId?: string;
  authorId: string;
  authorName?: string;
}): Promise<Note | undefined> {
  const retro = await getRetroById(params.retroId);
  if (!retro) return undefined;

  const desiredId = params.noteId && params.noteId.trim();
  const exists = desiredId ? retro.notes.some((n) => n.id === desiredId) : false;
  const note: Note = {
    id: desiredId && !exists ? desiredId : randomUUID(),
    retroId: retro.id,
    column: params.column,
    text: params.text,
    authorId: params.authorId,
    authorName: params.authorName,
    createdAt: Date.now()
  };

  retro.notes.push(note);
  await kv.hset("retros", { [retro.id]: retro });
  return note;
}

export async function toggleVote(params: { retroId: string; noteId: string; userId: string }): Promise<{ ok: boolean; reason?: string }> {
  // Backwards compatibility: toggleVote now behaves like addVote (idempotent).
  return addVote(params);
}

export async function addVote(params: { retroId: string; noteId: string; userId: string }): Promise<{ ok: boolean; reason?: string }> {
  const retro = await getRetroById(params.retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };

  const noteExists = retro.notes.some((n) => n.id === params.noteId);
  if (!noteExists) return { ok: false, reason: "NOT_FOUND" };

  const votes = retro.userVotes[params.userId] || [];
  if (votes.length >= MAX_VOTES_PER_USER) {
    return { ok: false, reason: "LIMIT" };
  }
  retro.userVotes[params.userId] = [...votes, params.noteId];
  await kv.hset("retros", { [retro.id]: retro });
  return { ok: true };
}

export async function removeVote(params: { retroId: string; noteId: string; userId: string }): Promise<{ ok: boolean; reason?: string }> {
  const retro = await getRetroById(params.retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };

  const votes = [...(retro.userVotes[params.userId] || [])];
  const idx = votes.indexOf(params.noteId);
  if (idx === -1) {
    return { ok: true };
  }
  votes.splice(idx, 1);
  retro.userVotes[params.userId] = votes;
  await kv.hset("retros", { [retro.id]: retro });
  return { ok: true };
}

export async function setRevealComments(retroId: string, reveal: boolean): Promise<{ ok: boolean; reason?: string }> {
  const retro = await getRetroById(retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };
  retro.revealComments = reveal;
  await kv.hset("retros", { [retro.id]: retro });
  return { ok: true };
}

export async function setPhaseOverride(retroId: string, phase: Phase | null): Promise<{ ok: boolean; reason?: string }> {
  const retro = await getRetroById(retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };
  if (!retro.startTime || !retro.durationMinutes) {
    return { ok: false, reason: "NOT_STARTED" };
  }
  // Only allow overriding to writing/voting; ideas is derived by endTime.
  if (phase && phase !== "writing" && phase !== "voting") {
    return { ok: false, reason: "INVALID" };
  }
  retro.phaseOverride = phase;
  await kv.hset("retros", { [retro.id]: retro });
  return { ok: true };
}

export async function endRetroEarly(retroId: string): Promise<{ ok: boolean; reason?: string }> {
  const retro = await getRetroById(retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };
  if (!retro.startTime || !retro.durationMinutes) {
    return { ok: false, reason: "NOT_STARTED" };
  }
  retro.endTimeOverride = Date.now();
  await kv.hset("retros", { [retro.id]: retro });
  return { ok: true };
}

export async function finishRetro(retroId: string): Promise<{ ok: boolean; reason?: string }> {
  const retro = await getRetroById(retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };
  if (retro.finished) return { ok: true };
  retro.finished = true;
  if (!retro.endTimeOverride) {
    retro.endTimeOverride = Date.now();
  }
  await kv.hset("retros", { [retro.id]: retro });
  return { ok: true };
}

export async function joinRetro(retroId: string, profile: { id: string; name: string; avatar: string }): Promise<{ ok: boolean; reason?: string }> {
  const retro = await getRetroById(retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };

  if (!retro.users) retro.users = {}; // migrate legacy if needed

  // Check if avatar is taken by another user
  const taken = Object.values(retro.users).find(u => u.avatar === profile.avatar && u.id !== profile.id);
  if (taken) {
    return { ok: false, reason: "AVATAR_TAKEN" };
  }

  retro.users[profile.id] = profile;
  await kv.hset("retros", { [retro.id]: retro });
  return { ok: true };
}

export function computePhase(retro: Retro, now: number): { phase: Phase; remainingMs: number | null; endTime: number | null } {
  if (!retro.startTime || !retro.durationMinutes) {
    return { phase: "planning", remainingMs: null, endTime: null };
  }
  const computedEndTime = retro.startTime + retro.durationMinutes * 60_000;
  const endTime = retro.endTimeOverride ?? computedEndTime;
  const remainingMs = Math.max(0, endTime - now);
  const fiveMinutesMs = 5 * 60_000;
  if (remainingMs === 0) {
    return { phase: "ideas", remainingMs: 0, endTime };
  }
  if (retro.phaseOverride === "voting") {
    return { phase: "voting", remainingMs, endTime };
  }
  if (retro.phaseOverride === "writing") {
    return { phase: "writing", remainingMs, endTime };
  }
  if (remainingMs <= fiveMinutesMs) {
    return { phase: "voting", remainingMs, endTime };
  }
  return { phase: "writing", remainingMs, endTime };
}

export function getVoteCounts(retro: Retro): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const note of retro.notes) {
    counts[note.id] = 0;
  }
  for (const userId of Object.keys(retro.userVotes)) {
    for (const noteId of retro.userVotes[userId]) {
      counts[noteId] = (counts[noteId] || 0) + 1;
    }
  }
  return counts;
}

export async function getSnapshot(id: string, now = Date.now()): Promise<RetroSnapshot | undefined> {
  const retro = await getRetroById(id);
  if (!retro) return undefined;
  const { phase, remainingMs, endTime } = computePhase(retro, now);
  const voteCounts = getVoteCounts(retro);
  const shouldRedactNotes = phase === "writing" && !retro.revealComments;
  const retroForClient: Retro = shouldRedactNotes
    ? {
      ...retro,
      notes: retro.notes.map((n) => ({
        ...n,
        text: ""
      }))
    }
    : retro;
  return { retro: retroForClient, phase, remainingMs, endTime, voteCounts };
}


