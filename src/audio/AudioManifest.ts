import type { RegisterAudioOptions } from "./AudioManager";

export const AudioId = {
  BgmMain: "bgm_main",
  UiClick: "click",
  BuildPlace: "build_place",
  BuildInvalid: "build_invalid",
  Jump: "jump",
  Coin: "coin",
  Death: "death",
  Goal: "goal",
  Win: "win",
  Boom: "boom",
  CrossbowFire: "crossbow_fire",
  ArrowHit: "arrow_hit",
} as const;

export type AudioId = (typeof AudioId)[keyof typeof AudioId];

const BASE = import.meta.env.BASE_URL;

export const AUDIO_MANIFEST: Record<AudioId, RegisterAudioOptions> = {
  [AudioId.BgmMain]: {
    channel: "bgm",
    url: BASE + "audio/bgm/main.mp3",
    volume: 0.6,
    loop: true,
  },

  [AudioId.UiClick]: {
    channel: "sfx",
    url: BASE + "audio/sfx/click.wav",
    volume: 0.7,
  },
  [AudioId.BuildPlace]: {
    channel: "sfx",
    url: BASE + "audio/sfx/build_place.wav",
    volume: 0.8,
  },
  [AudioId.BuildInvalid]: {
    channel: "sfx",
    url: BASE + "audio/sfx/build_invalid.ogg",
    volume: 1.1,
  },

  [AudioId.Jump]: {
    channel: "sfx",
    url: BASE + "audio/sfx/jump.wav",
    volume: 0.9,
  },
  [AudioId.Coin]: {
    channel: "sfx",
    url: BASE + "audio/sfx/coin.ogg",
    volume: 0.8,
  },
  [AudioId.Death]: {
    channel: "sfx",
    url: BASE + "audio/sfx/death.wav",
    volume: 1.0,
  },
  [AudioId.Goal]: {
    channel: "sfx",
    url: BASE + "audio/sfx/goal.wav",
    volume: 3.0,
  },
  [AudioId.Win]: {
    channel: "sfx",
    url: BASE + "audio/sfx/win.wav",
    volume: 1.0,
  },
  [AudioId.Boom]: {
    channel: "sfx",
    url: BASE + "audio/sfx/boom.wav",
    volume: 1.0,
  },

  [AudioId.CrossbowFire]: {
    channel: "sfx",
    url: BASE + "audio/sfx/crossbow_fire.wav",
    volume: 0.8,
  },
  [AudioId.ArrowHit]: {
    channel: "sfx",
    url: BASE + "audio/sfx/arrow_hit.wav",
    volume: 1.0,
  },
};
