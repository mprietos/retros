import { randomUUID } from "crypto";
import { Note, Phase, Retro, RetroSnapshot } from "@/lib/types";

const MAX_VOTES_PER_USER = 6;

type Store = {
  retros: Map<string, Retro>;
  nameToId: Map<string, string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __retroStore: Store | undefined;
}

function createEmptyStore(): Store {
  return {
    retros: new Map(),
    nameToId: new Map()
  };
}

function getStore(): Store {
  if (!global.__retroStore) {
    global.__retroStore = createEmptyStore();
  }
  return global.__retroStore;
}

export function listRetros(): Retro[] {
  const { retros } = getStore();
  return Array.from(retros.values());
}

export function getRetroById(id: string): Retro | undefined {
  const { retros } = getStore();
  return retros.get(id);
}

export function getRetroIdByName(name: string): string | undefined {
  const { nameToId } = getStore();
  return nameToId.get(name.toLowerCase());
}

export function createRetro(params: { name?: string; team: string; dateISO: string }): Retro {
  const { retros, nameToId } = getStore();
  const id = randomUUID();
  const name = (params.name && params.name.trim()) || `${params.team}-${params.dateISO}`.toLowerCase();
  const now = Date.now();
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
  retros.set(id, retro);
  nameToId.set(name.toLowerCase(), id);
  return retro;
}

export function startRetro(id: string, durationMinutes: number, starterUserId: string): Retro | undefined {
  const retro = getRetroById(id);
  if (!retro) return undefined;
  if (retro.startTime) return retro; // already started
  retro.startTime = Date.now();
  retro.durationMinutes = durationMinutes;
  retro.starterUserId = starterUserId;
  return retro;
}

export function addNote(params: {
  retroId: string;
  column: Note["column"];
  text: string;
  authorId: string;
  authorName?: string;
}): Note | undefined {
  const retro = getRetroById(params.retroId);
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
  return note;
}

export function toggleVote(params: { retroId: string; noteId: string; userId: string }): { ok: boolean; reason?: string } {
  const retro = getRetroById(params.retroId);
  if (!retro) return { ok: false, reason: "NOT_FOUND" };
  const votes = retro.userVotes[params.userId] || [];
  const has = votes.includes(params.noteId);
  if (has) {
    retro.userVotes[params.userId] = votes.filter((v) => v !== params.noteId);
    return { ok: true };
  }
  if (votes.length >= MAX_VOTES_PER_USER) {
    return { ok: false, reason: "LIMIT" };
  }
  retro.userVotes[params.userId] = [...votes, params.noteId];
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

export function getSnapshot(id: string, now = Date.now()): RetroSnapshot | undefined {
  const retro = getRetroById(id);
  if (!retro) return undefined;
  const { phase, remainingMs, endTime } = computePhase(retro, now);
  const voteCounts = getVoteCounts(retro);
  return { retro, phase, remainingMs, endTime, voteCounts };
}


