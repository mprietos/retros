import { NextApiRequest, NextApiResponse } from "next";
import { pusherServer } from "@/lib/pusher";
import { addNote, addVote, endRetroEarly, finishRetro, getSnapshot, joinRetro, removeVote, setPhaseOverride, setRevealComments, startRetro, toggleVote } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { retroId } = req.query;

    if (!retroId || typeof retroId !== "string") {
        return res.status(400).json({ error: "Missing retroId" });
    }

    if (req.method === "GET") {
        const snapshot = await getSnapshot(retroId);
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
                await startRetro(retroId, payload.durationMinutes, payload.starterUserId);
                snapshot = await getSnapshot(retroId);
                break;

            case "addNote":
                await addNote(payload);
                snapshot = await getSnapshot(retroId);
                break;

            case "toggleVote":
                const result = await toggleVote({
                    retroId,
                    noteId: payload.noteId,
                    userId: payload.userId
                });
                if (result.ok) {
                    snapshot = await getSnapshot(retroId);
                } else {
                    error = result.reason;
                }
                break;
            case "addVote":
                const addRes = await addVote({
                    retroId,
                    noteId: payload.noteId,
                    userId: payload.userId
                });
                if (addRes.ok) snapshot = await getSnapshot(retroId);
                else error = addRes.reason;
                break;
            case "removeVote":
                const removeRes = await removeVote({
                    retroId,
                    noteId: payload.noteId,
                    userId: payload.userId
                });
                if (removeRes.ok) snapshot = await getSnapshot(retroId);
                else error = removeRes.reason;
                break;

            case "setRevealComments":
                const revealRes = await setRevealComments(retroId, !!payload.reveal);
                if (revealRes.ok) snapshot = await getSnapshot(retroId);
                else error = revealRes.reason;
                break;

            case "setPhaseOverride":
                const phaseRes = await setPhaseOverride(retroId, payload.phase ?? null);
                if (phaseRes.ok) snapshot = await getSnapshot(retroId);
                else error = phaseRes.reason;
                break;

            case "endRetroEarly":
                const endRes = await endRetroEarly(retroId);
                if (endRes.ok) snapshot = await getSnapshot(retroId);
                else error = endRes.reason;
                break;

            case "finishRetro":
                const finishRes = await finishRetro(retroId);
                if (finishRes.ok) snapshot = await getSnapshot(retroId);
                else error = finishRes.reason;
                break;

            case "joinRetro":
                const joinRes = await joinRetro(retroId, payload.userProfile);
                if (joinRes.ok) {
                    snapshot = await getSnapshot(retroId);
                } else {
                    error = joinRes.reason;
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
