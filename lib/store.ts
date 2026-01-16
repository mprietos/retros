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
    notes: [],
    userVotes: {}
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

  await kv.hset("retros", { [id]: retro });
  return retro;
}

export async function addNote(params: {
  retroId: string;
  column: Note["column"];
  text: string;
  authorId: string;
  authorName?: string;
}): Promise<Note | undefined> {
  const retro = await getRetroById(params.retroId);
  if (!retro) return undefined;

  const note: Note = {
    id: randomUUID(),
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
  const retro = await getRetroById(params.retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };

  const votes = retro.userVotes[params.userId] || [];
  const has = votes.includes(params.noteId);

  if (has) {
    retro.userVotes[params.userId] = votes.filter((v) => v !== params.noteId);
  } else {
    if (votes.length >= MAX_VOTES_PER_USER) {
      return { ok: false, reason: "LIMIT" };
    }
    retro.userVotes[params.userId] = [...votes, params.noteId];
  }

  await kv.hset("retros", { [retro.id]: retro });
  return { ok: true };
}

export function computePhase(retro: Retro, now: number): { phase: Phase; remainingMs: number | null; endTime: number | null } {
  if (!retro.startTime || !retro.durationMinutes) {
    return { phase: "planning", remainingMs: null, endTime: null };
  }
  const endTime = retro.startTime + retro.durationMinutes * 60_000;
  const remainingMs = Math.max(0, endTime - now);
  const fiveMinutesMs = 5 * 60_000;
  if (remainingMs === 0) {
    return { phase: "ideas", remainingMs: 0, endTime };
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
  return { retro, phase, remainingMs, endTime, voteCounts };
}


