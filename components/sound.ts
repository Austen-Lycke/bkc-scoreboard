import { useEffect, useState } from "react";

/**
 * The TV's sounds, made with Web Audio (no files, works offline). Every tone has a soft attack and a
 * smooth fade, so nothing clicks; a gentle lowpass and compressor keep cheap speakers from fizzing.
 * Picked by ear on a listening page (2026-11-17): countdown and start = "C Helder", series start =
 * "C1" (one high pip), series end = "C3" (one long low tone).
 */

// Browsers only play sound after a click on the page; the TV window gets one when it's set up.
let ctx: AudioContext | null = null;
let out: AudioNode | null = null;

function context(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.8;
    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 7000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    master.connect(soften).connect(comp).connect(ctx.destination);
    out = master;
  }
  return ctx;
}

/** True once a click or key press on the page has unlocked sound. */
export function useSoundUnlocked(): boolean {
  const [on, setOn] = useState(() => ctx?.state === "running");
  useEffect(() => {
    if (on) return;
    const unlock = () => {
      const c = context();
      void c.resume().then(() => setOn(c.state === "running"));
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [on]);
  return on;
}

interface Voice {
  gain: number;
  attack?: number;
  hold?: number;
  release: number;
  detune?: number;
}

/** One sine voice with a smooth envelope. */
function tone(c: AudioContext, f: number, t: number, { gain, attack = 0.005, hold = 0, release, detune = 0 }: Voice) {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.frequency.value = f;
  osc.detune.value = detune;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.setValueAtTime(gain, t + attack + hold);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  osc.connect(env).connect(out!);
  osc.start(t);
  osc.stop(t + attack + hold + release + 0.05);
}

/** A small bell: a few partials, the higher ones fading first, with a slow shimmer. */
function bell(c: AudioContext, f: number, t: number, gain: number, length: number) {
  const partials = [
    [1, 1, 1],
    [2, 0.42, 0.6],
    [3, 0.2, 0.4],
    [4.2, 0.09, 0.25],
    [5.4, 0.04, 0.15],
  ];
  for (const [ratio, amp, decay] of partials) tone(c, f * ratio, t, { gain: gain * amp, attack: 0.004, release: length * decay });
  tone(c, f, t, { gain: gain * 0.35, attack: 0.004, release: length, detune: 5 });
}

/** A soft pip: a short held sine with a round onset, plus a whisper of the octave. */
function pip(c: AudioContext, f: number, t: number, gain: number, hold: number, release: number) {
  tone(c, f, t, { gain, attack: 0.012, hold, release });
  tone(c, f * 2, t, { gain: gain * 0.12, attack: 0.012, hold: hold * 0.6, release: release * 0.6 });
}

const C5 = 523.25;
const E5 = 659.25;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;

/** Plays `sound` now, if sound is unlocked; silent otherwise. */
function play(sound: (c: AudioContext, t: number) => void) {
  if (!ctx || ctx.state !== "running") return;
  sound(ctx, ctx.currentTime + 0.02);
}

/** 3, 2, 1: a soft mid pip. */
export const playTick = () => play((c, t) => pip(c, E5, t, 0.24, 0.12, 0.2));

/** Start of a beurt: a bright C-major chord of bells over a held pip. */
export const playGo = () =>
  play((c, t) => {
    bell(c, C6, t, 0.15, 1.1);
    bell(c, E6, t + 0.04, 0.13, 1.1);
    bell(c, G6, t + 0.08, 0.12, 1.3);
    pip(c, C6, t, 0.12, 0.3, 0.6);
  });

/** A WSA series starts: one high pip. */
export const playSeriesStart = () => play((c, t) => pip(c, E6, t, 0.2, 0.45, 0.5));

/** A WSA series ends: one long, low tone. */
export const playSeriesEnd = () => play((c, t) => pip(c, C5, t, 0.3, 0.6, 0.7));
