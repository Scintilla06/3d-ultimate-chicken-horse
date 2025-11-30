import { CharacterAppearance } from "./CharacterAppearance";

// Simple in-memory registry; can be expanded to support skins
const CHARACTER_DEFINITIONS: CharacterAppearance[] = [
  {
    id: "chicken",
    modelKey: "chicken",
    baseColor: 0xffffff,
    beakColor: 0xffa500,
    accentColor: 0xffcc66,
  },
  {
    id: "penguin",
    modelKey: "penguin",
    baseColor: 0x000000,
    beakColor: 0xffa500,
    accentColor: 0xffcc66,
  },
  {
    id: "robot",
    modelKey: "robot",
    baseColor: 0x888888,
    beakColor: 0xffffff,
    accentColor: 0x00ffff,
  },
];

export function getCharacterAppearance(
  id: string | undefined | null
): CharacterAppearance {
  const found = CHARACTER_DEFINITIONS.find((c) => c.id === id);
  return found ?? CHARACTER_DEFINITIONS[0];
}

export function listCharacterAppearances(): CharacterAppearance[] {
  return CHARACTER_DEFINITIONS.slice();
}

// TODO:
// - Extend CHARACTER_DEFINITIONS with more skins / variants per id
// - Potentially add a lookup by skinId if lobby needs skin selection
