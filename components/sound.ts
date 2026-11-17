import { useEffect, useState } from "react";

/**
 * The TV's sounds, made with Web Audio (no files, works offline). Every tone has a soft attack and a
 * smooth fade, so nothing clicks; a gentle lowpass and compressor keep cheap speakers from fizzing.
 * Picked by ear on a listening page (2026-11-17), in C major: E5 pips 1 s apart for 3-2-1, one high
 * E6 pip of 1.3 s for "Start!" and as a WSA series starts, three short low C5 tones as it ends.
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

/** A soft pip: a short held sine with a round onset, plus a whisper of the octave. */
function pip(c: AudioContext, f: number, t: number, gain: number, hold: number, release: number) {
  tone(c, f, t, { gain, attack: 0.012, hold, release });
  tone(c, f * 2, t, { gain: gain * 0.12, attack: 0.012, hold: hold * 0.6, release: release * 0.6 });
}

const C5 = 523.25;
const E5 = 659.25;
const E6 = 1318.51;

/** Plays `sound` now, if sound is unlocked; silent otherwise. */
function play(sound: (c: AudioContext, t: number) => void) {
  if (!ctx || ctx.state !== "running") return;
  sound(ctx, ctx.currentTime + 0.02);
}

/** 3, 2, 1: a soft mid pip. */
export const playTick = () => play((c, t) => pip(c, E5, t, 0.24, 0.12, 0.2));

/** A beurt or a WSA series starts: one high pip, an octave above the ticks, 1.3 seconds in all. */
export const playSeriesStart = () => play((c, t) => pip(c, E6, t, 0.2, 0.79, 0.5));

/** "Start!" after the 3-2-1: the same pip as a series start. */
export const playGo = playSeriesStart;

/** A WSA series ends: three short low tones, like archery's three blasts for "stop". */
export const playSeriesEnd = () =>
  play((c, t) => {
    for (let i = 0; i < 3; i++) pip(c, C5, t + i * 0.38, 0.3, 0.18, 0.14);
  });
