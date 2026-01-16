export const AVATARS = [
    "🐶", "🐱", "MOUSE", "🐹", "🐰", "FOX",
    "🐻", "PANDA", "KOALA", "TIGER", "LION",
    "COW", "PIG", "FROG", "MONKEY", "CHICKEN",
    "PENGUIN", "BIRD", "DUCK", "OWL"
].map(id => {
    // Mapping special text IDs to emojis if needed, or just using direct emoji strings
    // For simplicity and consistency, let's just use the emoji character as the ID and display
    if (id === "MOUSE") return "🐭";
    if (id === "FOX") return "🦊";
    if (id === "PANDA") return "🐼";
    if (id === "KOALA") return "🐨";
    if (id === "TIGER") return "🐯";
    if (id === "LION") return "🦁";
    if (id === "COW") return "🐮";
    if (id === "PIG") return "🐷";
    if (id === "FROG") return "🐸";
    if (id === "MONKEY") return "🐵";
    if (id === "CHICKEN") return "🐔";
    if (id === "PENGUIN") return "🐧";
    if (id === "BIRD") return "🐦";
    if (id === "DUCK") return "🦆";
    if (id === "OWL") return "🦉";
    return id;
});

export interface Avatar {
    id: string; // The emoji itself
    label?: string; // Optional label if we want accessible names
}

// Ensure unique set and proper objects if we expand later
export const AVATAR_LIST: Avatar[] = AVATARS.map(emoji => ({ id: emoji }));
