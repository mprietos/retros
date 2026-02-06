// NOTE:
// Keep this list to emojis that are widely supported on Windows and avoid ZWJ sequences
// (e.g. "👨‍🚀") because some environments render them as "�" / missing-glyph diamonds.
export const AVATARS = [
    // Faces
    "😀", "😄", "😁", "😅", "😂", "😊", "😎", "🤓", "😇", "🥳",
    "🤩", "😏", "🤗", "🤠", "🥸",
    // Animals
    "🐶", "🐱", "🐼", "🐸", "🦊", "🐵", "🐙", "🦄",
    "🐯", "🦁", "🐻", "🐨", "🐰", "🐷", "🐮", "🦋",
    "🐢", "🦉", "🐺", "🦈", "🐬", "🐧",
    // Fun / Objects
    "🌈", "🔥", "⭐", "⚡", "🚀", "🍕",
    "🎸", "🎮", "🧩", "🎯", "🏀", "🎲",
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
        "🤩": "Estrellitas",
        "😏": "Pillo",
        "🤗": "Abrazo",
        "🤠": "Vaquero",
        "🥸": "Disfraz",
        "🐶": "Perro",
        "🐱": "Gato",
        "🐼": "Panda",
        "🐸": "Rana",
        "🦊": "Zorro",
        "🐵": "Mono",
        "🐙": "Pulpo",
        "🦄": "Unicornio",
        "🐯": "Tigre",
        "🦁": "León",
        "🐻": "Oso",
        "🐨": "Koala",
        "🐰": "Conejo",
        "🐷": "Cerdo",
        "🐮": "Vaca",
        "🦋": "Mariposa",
        "🐢": "Tortuga",
        "🦉": "Búho",
        "🐺": "Lobo",
        "🦈": "Tiburón",
        "🐬": "Delfín",
        "🐧": "Pingüino",
        "🌈": "Arcoíris",
        "🔥": "Fuego",
        "⭐": "Estrella",
        "⚡": "Rayo",
        "🚀": "Cohete",
        "🍕": "Pizza",
        "🎸": "Guitarra",
        "🎮": "Mando",
        "🧩": "Puzzle",
        "🎯": "Diana",
        "🏀": "Baloncesto",
        "🎲": "Dado",
    };
    return { id: emoji, label: labels[emoji] || "Avatar" };
});
