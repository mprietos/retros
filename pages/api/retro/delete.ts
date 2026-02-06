import { NextApiRequest, NextApiResponse } from "next";
import { deleteRetro } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { retroId } = req.body;
  if (!retroId || typeof retroId !== "string") {
    return res.status(400).json({ error: "Missing retroId" });
  }

  const result = await deleteRetro(retroId);
  if (!result.ok) {
    return res.status(404).json({ error: result.reason });
  }

  return res.status(200).json({ success: true });
}
