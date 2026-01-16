export const AVATARS = [
    // Space Adventures
    "�", "�", "👨‍🚀", "�‍🚀", "�", "🤖", "🪐", "🌠", "�️", "☄️",
    // Superheroes & Villains
    "🦸‍♂️", "🦸‍♀️", "🦹‍♂️", "🦹‍♀️", "🥷", "⚡️", "💥", "🛡️", "⚔️", "🦾",
    // Sci-Fi / Fun
    "🦇", "🕷️", "🐲", "🔮", "🌋"
];

export interface Avatar {
    id: string; // The emoji itself
    label?: string; // Optional label for tooltips
}

export const AVATAR_LIST: Avatar[] = AVATARS.map(emoji => {
    const labels: Record<string, string> = {
        "🚀": "Cohete",
        "🛸": "OVNI",
        "👨‍🚀": "Astronauta",
        "👩‍🚀": "Astronauta",
        "👽": "Alien",
        "🤖": "Robot",
        "🪐": "Planeta",
        "🌠": "Estrella",
        "🛰️": "Satélite",
        "☄️": "Cometa",
        "🦸‍♂️": "Superhéroe",
        "🦸‍♀️": "Superheroína",
        "🦹‍♂️": "Villano",
        "🦹‍♀️": "Villana",
        "🥷": "Ninja",
        "⚡️": "Rayo",
        "💥": "Explosión",
        "🛡️": "Escudo",
        "⚔️": "Espadas",
        "🦾": "Ciborg",
        "🦇": "Murciélago",
        "🕷️": "Araña",
        "🐲": "Dragón",
        "🔮": "Futuro",
        "🌋": "Destrucción"
    };
    return { id: emoji, label: labels[emoji] || "Avatar" };
});
