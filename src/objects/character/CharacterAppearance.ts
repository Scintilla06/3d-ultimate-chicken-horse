export type CharacterAnimState =
  | "idle"
  | "run"
  | "jump"
  | "fall"
  | "dead"
  | "win";

export interface CharacterAppearance {
  id: string; // e.g. 'chicken', 'penguin'

  // Base model key in Resources.models, e.g. 'chicken_rigged' or simple placeholder
  modelKey: string;

  // Simple palette configuration; can be extended
  baseColor?: number;
  beakColor?: number;
  accentColor?: number;

  // Optional attachments which can be mapped to extra models
  attachments?: {
    hatModelKey?: string;
    tailModelKey?: string;
    accessoryModelKeys?: string[];
  };
}
