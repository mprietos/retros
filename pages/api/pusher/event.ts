import { NextApiRequest, NextApiResponse } from "next";
import { pusherServer } from "@/lib/pusher";
import { addNote, getSnapshot, startRetro, toggleVote } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { retroId } = req.query;

    if (!retroId || typeof retroId !== "string") {
        return res.status(400).json({ error: "Missing retroId" });
    }

    if (req.method === "GET") {
        const snapshot = getSnapshot(retroId);
        if (!snapshot) {
            return res.status(404).json({ error: "Retro not found" });
        }
        return res.status(200).json(snapshot);
    }

    if (req.method === "POST") {
        const { action, ...payload } = req.body;

        // Ensure payload has retroId
        payload.retroId = retroId;

        let snapshot;
        let error;

        switch (action) {
            case "startRetro":
                startRetro(retroId, payload.durationMinutes, payload.starterUserId);
                snapshot = getSnapshot(retroId);
                break;

            case "addNote":
                addNote(payload);
                snapshot = getSnapshot(retroId);
                break;

            case "toggleVote":
                const result = toggleVote({
                    retroId,
                    noteId: payload.noteId,
                    userId: payload.userId
                });
                if (result.ok) {
                    snapshot = getSnapshot(retroId);
                } else {
                    error = result.reason;
                }
                break;

            default:
                return res.status(400).json({ error: "Invalid action" });
        }

        if (error) {
            return res.status(400).json({ error });
        }

        if (snapshot) {
            // Trigger update to all clients subscribed to this retro
            await pusherServer.trigger(retroId, "state", snapshot);
            return res.status(200).json({ success: true, snapshot });
        } else {
            return res.status(500).json({ error: "Failed to process action" });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}
