// NOTE:
// Keep this list to emojis that are widely supported on Windows and avoid ZWJ sequences
// (e.g. "👨‍🚀") because some environments render them as "�" / missing-glyph diamonds.
export const AVATARS = [
    // Faces
    "😀", "😄", "😁", "😅", "😂", "😊", "😎", "🤓", "😇", "🥳",
    // Animals
    "🐶", "🐱", "🐼", "🐸", "🦊", "🐵", "🐙", "🦄",
    // Fun
    "🌈", "🔥", "⭐", "⚡", "🚀", "🍕"
];

export interface Avatar {
    id: string; // The emoji itself
    label?: string; // Optional label for tooltips
}

export const AVATAR_LIST: Avatar[] = AVATARS.map(emoji => {
    const labels: Record<string, string> = {
        "😀": "Sonrisa",
        "😄": "Feliz",
        "😁": "Genial",
        "😅": "Sudor",
        "😂": "Risa",
        "😊": "Amable",
        "😎": "Guay",
        "🤓": "Friki",
        "😇": "Inocente",
        "🥳": "Fiesta",
        "🐶": "Perro",
        "🐱": "Gato",
        "🐼": "Panda",
        "🐸": "Rana",
        "🦊": "Zorro",
        "🐵": "Mono",
        "🐙": "Pulpo",
        "🦄": "Unicornio",
        "🌈": "Arcoíris",
        "🔥": "Fuego",
        "⭐": "Estrella",
        "⚡": "Rayo",
        "🚀": "Cohete",
        "🍕": "Pizza"
    };
    return { id: emoji, label: labels[emoji] || "Avatar" };
});
