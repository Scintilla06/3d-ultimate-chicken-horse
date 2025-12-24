export type AudioChannel = "bgm" | "sfx";

export interface RegisterAudioOptions {
  channel: AudioChannel;
  url: string;
  volume?: number; // per-sound multiplier (1 = unchanged)
  loop?: boolean; // mainly for bgm
}

export interface PlaySfxOptions {
  volume?: number; // additional multiplier
  playbackRate?: number;
}

interface RegisteredAudio {
  channel: AudioChannel;
  url: string;
  volume: number;
  loop: boolean;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private registered: Map<string, RegisteredAudio> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();
  private loading: Map<string, Promise<AudioBuffer | null>> = new Map();

  private bgmSource: AudioBufferSourceNode | null = null;
  private pendingBgmId: string | null = null;

  private masterVolume = 1.0;
  private bgmVolume = 0.6;
  private sfxVolume = 0.9;

  public register(id: string, options: RegisterAudioOptions): void {
    this.registered.set(id, {
      channel: options.channel,
      url: options.url,
      volume: options.volume ?? 1.0,
      loop: options.loop ?? false,
    });
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = this.clamp01(volume);
    this.syncGains();
  }

  public setBgmVolume(volume: number): void {
    this.bgmVolume = this.clamp01(volume);
    this.syncGains();
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = this.clamp01(volume);
    this.syncGains();
  }

  /**
   * Must be called from a user gesture (click/mousedown/key) to satisfy autoplay policies.
   */
  public async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctx = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;

      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.syncGains();
    }

    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch {
        // ignore
      }
    }

    if (this.pendingBgmId) {
      const id = this.pendingBgmId;
      this.pendingBgmId = null;
      await this.playBgm(id);
    }
  }

  public async preload(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.loadBuffer(id)));
  }

  public async playBgm(id: string): Promise<void> {
    // If audio isn't unlocked yet, remember the intention.
    if (!this.ctx || this.ctx.state !== "running") {
      this.pendingBgmId = id;
      return;
    }

    const meta = this.registered.get(id);
    if (!meta) return;

    const buffer = await this.loadBuffer(id);
    if (!buffer) return;

    this.stopBgm();

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = meta.loop;

    const gain = this.ctx.createGain();
    gain.gain.value = meta.volume;

    source.connect(gain);
    gain.connect(this.bgmGain!);

    source.start();
    this.bgmSource = source;
  }

  public stopBgm(): void {
    if (!this.bgmSource) return;
    try {
      this.bgmSource.stop();
    } catch {
      // ignore
    }
    this.bgmSource.disconnect();
    this.bgmSource = null;
  }

  public playSfx(id: string, options?: PlaySfxOptions): void {
    if (!this.ctx || this.ctx.state !== "running") return;

    const meta = this.registered.get(id);
    if (!meta) return;

    const buffer = this.buffers.get(id);
    if (!buffer) {
      // Lazy load; if it finishes later that's fine.
      void this.loadBuffer(id);
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options?.playbackRate ?? 1.0;

    const gain = this.ctx.createGain();
    const vol = meta.volume * (options?.volume ?? 1.0);
    gain.gain.value = vol;

    source.connect(gain);
    gain.connect(this.sfxGain!);

    source.start();
  }

  private async loadBuffer(id: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return cached;

    const inflight = this.loading.get(id);
    if (inflight) return inflight;

    const meta = this.registered.get(id);
    if (!meta || !this.ctx) {
      return null;
    }

    const task = (async () => {
      try {
        const res = await fetch(meta.url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        const buffer = await this.ctx!.decodeAudioData(arrayBuffer);
        this.buffers.set(id, buffer);
        return buffer;
      } catch {
        return null;
      } finally {
        this.loading.delete(id);
      }
    })();

    this.loading.set(id, task);
    return task;
  }

  private syncGains(): void {
    if (!this.masterGain || !this.bgmGain || !this.sfxGain) return;
    this.masterGain.gain.value = this.masterVolume;
    this.bgmGain.gain.value = this.bgmVolume;
    this.sfxGain.gain.value = this.sfxVolume;
  }

  private clamp01(v: number): number {
    if (!Number.isFinite(v)) return 1.0;
    return Math.max(0, Math.min(1, v));
  }
}
