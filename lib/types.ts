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

export interface Retro {
  id: string;
  name: string;
  team: string;
  dateISO: string;
  createdAt: number;
  durationMinutes: number | null;
  startTime: number | null;
  starterUserId: string | null;
  notes: Note[];
  userVotes: Record<string, string[]>; // userId -> noteIds
}

export type Phase = "planning" | "writing" | "voting" | "ideas";

export interface RetroSnapshot {
  retro: Retro;
  phase: Phase;
  remainingMs: number | null;
  endTime: number | null;
  voteCounts: Record<string, number>; // noteId -> votes
}


