/**
 * Generative Hintergrundmusik (WebAudio, keine Dateien, keine Lizenzen). Je Stimmung eine Tonleiter,
 * eine Akkordfolge, Tempo und Instrumente; Melodie und Rhythmus entstehen zufällig, klingen aber
 * wegen der festen Tonleiter immer stimmig. Der Planer arbeitet mit kurzem Vorlauf.
 */
export type Mood = 'town' | 'field' | 'moor' | 'dungeon' | 'ash' | 'boss';

interface MoodDef {
  /** Grundton in Hz */
  root: number;
  /** Tonleiter in Halbtönen über dem Grundton */
  scale: number[];
  /** Akkordfolge als Stufen der Tonleiter (je ein Takt) */
  prog: number[];
  bpm: number;
  /** Chance je Schlag auf einen Melodieton */
  melody: number;
  /** Klangfarbe der Melodie */
  lead: OscillatorType;
  /** Trommelpuls (0 = keiner, 1 = jeder Schlag, 2 = jeder zweite) */
  drum: 0 | 1 | 2;
  pad: OscillatorType;
  /** Helligkeit des Pads (Tiefpass in Hz) */
  bright: number;
  /** Lautstärke 0–1 */
  vol: number;
}

const MOODS: Record<Mood, MoodDef> = {
  // Warm, dorisch: Laute und weiches Pad
  town: { root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 4, 0, 5, 3, 4, 0], bpm: 72, melody: 0.5, lead: 'triangle', drum: 0, pad: 'sine', bright: 1400, vol: 0.9 },
  // Weit, äolisch, ruhig
  field: { root: 130.81, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], bpm: 64, melody: 0.38, lead: 'sine', drum: 0, pad: 'triangle', bright: 1000, vol: 0.85 },
  // Phrygisch, dünn und unheimlich
  moor: { root: 123.47, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], bpm: 52, melody: 0.26, lead: 'sine', drum: 0, pad: 'sawtooth', bright: 520, vol: 0.8 },
  // Tief, fast nur Brummen und seltene Töne
  dungeon: { root: 82.41, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 0, 1, 0], bpm: 46, melody: 0.14, lead: 'triangle', drum: 0, pad: 'sawtooth', bright: 380, vol: 0.85 },
  // Harmonisch Moll, schwere Pauken
  ash: { root: 110, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 6, 0, 3, 5, 6, 0], bpm: 60, melody: 0.3, lead: 'sawtooth', drum: 2, pad: 'sawtooth', bright: 700, vol: 0.85 },
  // Bossmusik: schneller, dicht, jeder Schlag Trommel
  boss: { root: 98, scale: [0, 1, 3, 5, 6, 8, 11], prog: [0, 1, 0, 5, 0, 6, 1, 0], bpm: 104, melody: 0.55, lead: 'sawtooth', drum: 1, pad: 'sawtooth', bright: 900, vol: 1 },
};

export class Music {
  private mood: Mood | null = null;
  private next = 0;
  private beat = 0;
  private timer = 0;
  private bus: GainNode;
  private echo: DelayNode;
  private enabled = true;

  constructor(private ctx: AudioContext, out: AudioNode, private noiseBuf: AudioBuffer) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    // Einfacher Hall: Verzögerung mit Rückkopplung, tiefpassgefiltert
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.43;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    this.echo.connect(lp).connect(fb).connect(this.echo);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.echo.connect(wet).connect(this.bus);
    this.bus.connect(out);
    this.next = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 200);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.fade();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setMood(m: Mood | null): void {
    if (m === this.mood) return;
    this.mood = m;
    this.beat = 0;
    this.next = Math.max(this.next, this.ctx.currentTime + 0.3);
    this.fade();
  }

  private fade(): void {
    const t = this.ctx.currentTime;
    const v = this.enabled && this.mood ? 0.5 * MOODS[this.mood].vol : 0;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(v, t, 1.5);
  }

  private hz(d: MoodDef, degree: number, octave = 0): number {
    const n = d.scale.length;
    const idx = ((degree % n) + n) % n;
    const oct = Math.floor(degree / n) + octave;
    return d.root * 2 ** ((d.scale[idx]! + 12 * oct) / 12);
  }

  private schedule(): void {
    if (!this.mood || !this.enabled || this.ctx.state !== 'running') {
      this.next = Math.max(this.next, this.ctx.currentTime);
      return;
    }
    const d = MOODS[this.mood];
    const spb = 60 / d.bpm;
    while (this.next < this.ctx.currentTime + 1.2) {
      this.play(d, this.beat, this.next, spb);
      this.next += spb;
      this.beat++;
    }
  }

  private play(d: MoodDef, beat: number, t: number, spb: number): void {
    const inBar = beat % 4;
    const bar = Math.floor(beat / 4);
    const chord = d.prog[bar % d.prog.length]!;
    if (inBar === 0) {
      // Pad: Grundton, Terz und Quinte der Stufe, lang ein- und ausgeblendet
      for (const off of [0, 2, 4]) this.voice(this.hz(d, chord + off, -1), d.pad, t, spb * 4.2, 0.07, d.bright);
      this.voice(this.hz(d, chord, -2), 'sine', t, spb * 4, 0.16, 300);
    }
    if (d.drum && (d.drum === 1 || inBar % 2 === 0)) this.drum(t, inBar === 0 ? 1 : 0.6, d.drum === 1 && inBar % 2 === 1);
    if (Math.random() < d.melody) {
      // Melodieton: Akkordton oder Nachbar, eine Oktave höher; manchmal zwei Achtel
      const degree = chord + [0, 1, 2, 3, 4, 6][Math.floor(Math.random() * 6)]!;
      this.pluck(this.hz(d, degree, 1), d.lead, t, spb * (1.2 + Math.random()), 0.1);
      if (Math.random() < 0.3) this.pluck(this.hz(d, degree + 1, 1), d.lead, t + spb / 2, spb, 0.07);
    }
  }

  private voice(f: number, type: OscillatorType, t: number, dur: number, vol: number, cutoff: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 12;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pluck(f: number, type: OscillatorType, t: number, dur: number, vol: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g);
    g.connect(this.bus);
    g.connect(this.echo);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(t: number, vol: number, light: boolean): void {
    const c = this.ctx;
    if (!light) {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
      const g = c.createGain();
      g.gain.setValueAtTime(0.5 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.bus);
      o.start(t);
      o.stop(t + 0.4);
    }
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = light ? 5000 : 900;
    const g2 = c.createGain();
    g2.gain.setValueAtTime((light ? 0.07 : 0.14) * vol, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    s.connect(f).connect(g2).connect(this.bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + 0.12);
  }

  dispose(): void {
    window.clearInterval(this.timer);
  }
}
