import { NextRequest, NextResponse } from "next/server";
import { getRetroById, addActionItem, clearActionItems } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { retroId } = await req.json();
  if (!retroId) {
    return NextResponse.json({ error: "Missing retroId" }, { status: 400 });
  }

  const retro = await getRetroById(retroId);
  if (!retro) {
    return NextResponse.json({ error: "Retro not found" }, { status: 404 });
  }

  if (retro.notes.length === 0) {
    return NextResponse.json({ error: "No hay comentarios en la retro" }, { status: 400 });
  }

  // Clear existing action items before generating new ones
  await clearActionItems(retroId);

  const good = retro.notes.filter(n => n.column === "good").map(n => n.text).join("\n- ");
  const bad = retro.notes.filter(n => n.column === "bad").map(n => n.text).join("\n- ");
  const ideas = retro.notes.filter(n => n.column === "ideas").map(n => n.text).join("\n- ");

  const prompt = `Eres un facilitador de retrospectivas de Scrum. Analiza los comentarios de esta retro y genera exactamente 2 acciones de mejora concretas, específicas y accionables para el próximo sprint.

COSAS QUE FUERON BIEN:
- ${good || "(ninguna)"}

COSAS QUE NO FUERON BIEN:
- ${bad || "(ninguna)"}

IDEAS:
- ${ideas || "(ninguna)"}

Responde SOLO con un JSON array de 2 strings, sin markdown ni explicación. Ejemplo: ["Acción 1", "Acción 2"]
Cada acción debe ser concreta (quién, qué, cuándo) y en español.`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("Groq API error:", err);
      return NextResponse.json({ error: "Error al llamar a la IA" }, { status: 502 });
    }

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ error: "La IA no devolvió respuesta" }, { status: 502 });
    }

    // Parse the JSON array from the response
    let actions: string[];
    try {
      // Handle potential markdown code blocks
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      actions = JSON.parse(cleaned);
      if (!Array.isArray(actions) || actions.length === 0) {
        throw new Error("Not an array");
      }
      actions = actions.slice(0, 2).map(a => String(a).trim()).filter(Boolean);
    } catch {
      return NextResponse.json({ error: "No se pudo interpretar la respuesta de la IA" }, { status: 502 });
    }

    // Save action items
    const savedItems = [];
    for (const text of actions) {
      const result = await addActionItem({
        retroId,
        text,
        authorId: "ai",
        authorName: "IA"
      });
      if (result.ok && result.actionItem) {
        savedItems.push(result.actionItem);
      }
    }

    return NextResponse.json({ actionItems: savedItems });
  } catch (e) {
    console.error("Error generating actions:", e);
    return NextResponse.json({ error: "Error de conexión con la IA" }, { status: 500 });
  }
}
