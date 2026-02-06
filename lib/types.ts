export type ColumnKey = "good" | "bad" | "ideas";

export interface Note {
  id: string;
  retroId: string;
  column: ColumnKey;
  text: string;
  authorId: string;
  authorName?: string;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string; // emoji character
}

export interface Retro {
  id: string;
  name: string;
  team: string;
  dateISO: string;
  createdAt: number;
  durationMinutes: number | null;
  startTime: number | null;
  starterUserId: string | null;
  endTimeOverride?: number | null; // if set, overrides computed end time
  phaseOverride?: Phase | null; // if set, forces phase (e.g. allow voting early)
  revealComments?: boolean; // if true, comments are visible even during writing
  finished?: boolean; // if true, retro is finalized and no one can enter
  notes: Note[];
  userVotes: Record<string, string[]>; // userId -> noteIds
  users: Record<string, UserProfile>; // userId -> UserProfile
}

export type Phase = "planning" | "writing" | "voting" | "ideas";

export interface RetroSnapshot {
  retro: Retro;
  phase: Phase;
  remainingMs: number | null;
  endTime: number | null;
  voteCounts: Record<string, number>; // noteId -> votes
}


