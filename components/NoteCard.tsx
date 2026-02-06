import React from "react";
import clsx from "clsx";
import Image from "next/image";

function extractGifUrl(text: string): string | null {
  const urls = Array.from(text.matchAll(/https?:\/\/\S+/g)).map((m) => m[0]);
  const isGif = (u: string) =>
    /\.gif(\?.*)?$/i.test(u) || u.includes("giphy.com/media") || u.includes("tenor.com/view");
  return urls.find(isGif) ?? null;
}

export default function NoteCard({
  text,
  blurred,
  votes,
  canVote,
  authorName,
  myVotes,
  remainingVotes,
  onAddVote,
  onRemoveVote
}: {
  text: string;
  blurred: boolean;
  votes: number;
  canVote: boolean;
  authorName?: string;
  myVotes: number;
  remainingVotes: number;
  onAddVote?: () => void;
  onRemoveVote?: () => void;
}) {
  const gifUrl = !blurred ? extractGifUrl(text) : null;
  // Strip the GIF URL from display text so only the image shows
  const cleanText = gifUrl ? text.replace(gifUrl, "").trim() : text;
  const displayText = blurred && !text ? "Nota oculta" : cleanText;
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      {displayText && (
        <div className={clsx("text-sm whitespace-pre-wrap", blurred && "blurred select-none", blurred && !text && "italic text-gray-400")}>{displayText}</div>
      )}
      {gifUrl && (
        <div className="mt-2">
          <Image
            src={gifUrl}
            alt="GIF"
            width={480}
            height={270}
            className="h-auto w-auto max-h-64 rounded"
            unoptimized
          />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          {authorName && (
            <span className="inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-0.5">
              por <span className="font-medium text-gray-800">{authorName}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5">
            ⭐ <span className="font-medium">{votes}</span>
          </span>
        </div>
        {canVote && (
          <div className="flex items-center gap-1">
            <button
              onClick={onRemoveVote}
              disabled={myVotes === 0}
              className="rounded bg-gray-200 px-2 py-1 font-bold text-gray-700 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center font-bold text-blue-700">{myVotes}</span>
            <button
              onClick={onAddVote}
              disabled={remainingVotes === 0}
              className="rounded bg-blue-600 px-2 py-1 font-bold text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
