/**
 * Synthetische Soundeffekte (WebAudio, keine Dateien). Der AudioContext startet erst nach der
 * ersten Eingabe (Browser-Regel). M schaltet stumm.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private last: Record<string, number> = {};
  private noiseBuf: AudioBuffer | null = null;
  private bed: { noise: GainNode; lp: BiquadFilterNode; drone: GainNode; osc: OscillatorNode } | null = null;
  private bedKind: 'wind' | 'embers' | 'cave' | null = null;
  private rainGain: GainNode | null = null;
  private rainLevel = 0;

  constructor() {
    const start = () => this.ensure();
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', (e) => {
      start();
      if (e.key.toLowerCase() === 'm') this.toggleMute();
    });
    try {
      this.muted = window.localStorage.getItem('aschenthron.muted') === '1';
    } catch {
      /* ohne Speicher: Standard */
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    try {
      window.localStorage.setItem('aschenthron.muted', this.muted ? '1' : '0');
    } catch {
      /* egal */
    }
  }

  private ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.35;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startBed();
  }

  /** Dauerhafter Zonenton: gefiltertes Rauschen plus tiefer Brummton, Pegel und Klangfarbe folgen der Zone. */
  private startBed(): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    const noise = c.createGain();
    noise.gain.value = 0;
    src.connect(lp).connect(noise).connect(this.master!);
    src.start();
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const drone = c.createGain();
    drone.gain.value = 0;
    osc.connect(drone).connect(this.master!);
    osc.start();
    this.bed = { noise, lp, drone, osc };
    // Regenbett: eigenes Rauschen, Bandpass um 3 kHz, nur bei Regen hörbar
    const rs = c.createBufferSource();
    rs.buffer = this.noiseBuf;
    rs.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.4;
    this.rainGain = c.createGain();
    this.rainGain.gain.value = 0;
    rs.connect(bp).connect(this.rainGain).connect(this.master!);
    rs.start();
    this.ambient(this.bedKind);
    this.rain(this.rainLevel);
  }

  /** Umgebungston der Zone: Wind (Moor), Glut (Aschenöde), Höhle (Dungeons) oder Stille. */
  ambient(kind: 'wind' | 'embers' | 'cave' | null): void {
    this.bedKind = kind;
    if (!this.bed || !this.ctx) return;
    const t = this.ctx.currentTime;
    const p = { wind: [520, 0.05, 0, 55], embers: [220, 0.045, 0.05, 41], cave: [140, 0.03, 0.06, 49], none: [300, 0, 0, 55] }[kind ?? 'none']!;
    this.bed.lp.frequency.setTargetAtTime(p[0]!, t, 1.2);
    this.bed.noise.gain.setTargetAtTime(p[1]!, t, 1.2);
    this.bed.drone.gain.setTargetAtTime(p[2]!, t, 1.2);
    this.bed.osc.frequency.setTargetAtTime(p[3]!, t, 1.2);
  }

  /** Regenrauschen 0–1 (leise; M schaltet über den Master stumm). */
  rain(level: number): void {
    this.rainLevel = level;
    if (this.rainGain && this.ctx) this.rainGain.gain.setTargetAtTime(level * 0.11, this.ctx.currentTime, 0.8);
  }

  private gate(name: string, ms: number): boolean {
    const now = performance.now();
    if (now - (this.last[name] ?? 0) < ms) return false;
    this.last[name] = now;
    return !!this.ctx && !!this.master && this.ctx.state === 'running';
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, lowpass: number, delay = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  hit(): void {
    if (!this.gate('hit', 60)) return;
    this.noise(0.09, 0.5, 1800);
    this.tone(160, 0.08, 'square', 0.18, 70);
  }
  crit(): void {
    if (!this.gate('crit', 60)) return;
    this.noise(0.12, 0.6, 3200);
    this.tone(260, 0.1, 'square', 0.22, 90);
    this.tone(1200, 0.08, 'triangle', 0.14, 600, 0.02);
  }
  rare(): void {
    if (!this.gate('rare', 400)) return;
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.16, undefined, i * 0.07));
  }
  hurt(): void {
    if (!this.gate('hurt', 120)) return;
    this.noise(0.14, 0.45, 900);
    this.tone(110, 0.16, 'sawtooth', 0.2, 55);
  }
  kill(): void {
    if (!this.gate('kill', 80)) return;
    this.tone(220, 0.25, 'triangle', 0.25, 60);
    this.noise(0.2, 0.3, 700);
  }
  pickup(): void {
    if (!this.gate('pickup', 60)) return;
    this.tone(660, 0.07, 'square', 0.12);
    this.tone(990, 0.1, 'square', 0.12, undefined, 0.06);
  }
  coin(): void {
    if (!this.gate('coin', 80)) return;
    this.tone(1200, 0.08, 'sine', 0.14);
    this.tone(1600, 0.12, 'sine', 0.14, undefined, 0.05);
  }
  potion(): void {
    if (!this.gate('potion', 100)) return;
    this.tone(300, 0.1, 'sine', 0.2, 500);
    this.tone(420, 0.12, 'sine', 0.2, 700, 0.1);
  }
  cast(area: string): void {
    if (!this.gate('cast', 80)) return;
    if (area === 'Magie') {
      this.tone(500, 0.3, 'sawtooth', 0.14, 1400);
      this.noise(0.25, 0.2, 3000);
    } else if (area === 'Fernkampf') {
      this.tone(900, 0.12, 'triangle', 0.15, 300);
      this.noise(0.1, 0.25, 4000);
    } else {
      this.tone(140, 0.2, 'sawtooth', 0.2, 60);
      this.noise(0.14, 0.4, 1200);
    }
  }
  levelUp(): void {
    if (!this.gate('levelup', 500)) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.2, undefined, i * 0.1));
  }
  quest(): void {
    if (!this.gate('quest', 300)) return;
    [440, 554, 659].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.18, undefined, i * 0.12));
  }
  death(): void {
    if (!this.gate('death', 1000)) return;
    this.tone(180, 1.2, 'sawtooth', 0.25, 40);
    this.noise(0.9, 0.3, 500);
  }
  warn(): void {
    if (!this.gate('warn', 300)) return;
    this.tone(200, 0.35, 'sawtooth', 0.12, 120);
    this.tone(300, 0.2, 'square', 0.06, 200, 0.05);
  }
  miss(): void {
    if (!this.gate('miss', 80)) return;
    this.noise(0.08, 0.2, 3500);
    this.tone(500, 0.08, 'sine', 0.06, 250);
  }
  chest(): void {
    if (!this.gate('chest', 200)) return;
    this.tone(120, 0.25, 'sawtooth', 0.12, 80);
    [880, 1100, 1320].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.14, undefined, 0.12 + i * 0.07));
    this.noise(0.12, 0.2, 5000, 0.1);
  }
  legendary(): void {
    if (!this.gate('legendary', 800)) return;
    [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.22, undefined, i * 0.09));
    this.tone(98, 1.0, 'sine', 0.25, 196);
    this.noise(0.4, 0.12, 6000, 0.35);
  }
  boss(): void {
    if (!this.gate('boss', 1000)) return;
    this.tone(80, 0.9, 'sawtooth', 0.3, 50);
    this.tone(120, 0.9, 'square', 0.15, 70);
  }
  /** Edelstein aufgehoben: heller, kurzer Glockenton. */
  gem(): void {
    if (!this.gate('gem', 150)) return;
    [1318, 1760, 2093].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.12, undefined, i * 0.06));
  }
  /** Weltboss gefallen: Fanfare aus aufsteigenden Dreiklängen. */
  fanfare(): void {
    if (!this.gate('fanfare', 2000)) return;
    [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.55, 'triangle', 0.22, undefined, i * 0.11));
    [131, 196].forEach((f, i) => this.tone(f, 1.2, 'sawtooth', 0.12, undefined, 0.3 + i * 0.2));
    this.noise(0.5, 0.1, 5000, 0.5);
  }
}
