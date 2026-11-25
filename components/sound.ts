import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * The TV's sounds, made with Web Audio (no files, works offline). Every tone has a soft attack and a
 * smooth fade, so nothing clicks; a gentle lowpass and compressor keep cheap speakers from fizzing.
 * Picked by ear on a listening page (2026-11-17), in C major: E5 pips 1 s apart for 3-2-1, one high
 * E6 pip of 1.3 s for "Start!", three short low C5 tones as a WSA series ends or is
 * paused.
 */

// Browsers only play sound after a click on the page; the TV window gets one when it's set up.
let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

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
    ctx.addEventListener("statechange", notify);
  }
  return ctx;
}

const isRunning = () => ctx?.state === "running";

/** Tries to get sound going again; works without a new click once the page has had one. */
function revive() {
  if (ctx && ctx.state !== "running") void ctx.resume().then(notify, notify);
}

/** Starts over with a fresh context: the old one hangs on a speaker that's gone. */
function rebuild() {
  const old = ctx;
  if (!old) return;
  old.removeEventListener("statechange", notify);
  ctx = null;
  void old.close().catch(() => {});
  void context().resume().then(notify, notify);
}

/**
 * True while sound can play: after a click or key press on the page, and as long as the browser keeps
 * it running. It can fall silent later on (the speaker or the HDMI/AirPlay screen goes away, the laptop
 * sleeps), so this keeps watching and gets it going again, by itself or on the next click.
 */
export function useSoundUnlocked(): boolean {
  const on = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    isRunning,
    () => false,
  );
  useEffect(() => {
    const unlock = () => {
      if (!isRunning()) void context().resume().then(notify, notify);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("focus", revive);
    document.addEventListener("visibilitychange", revive);
    navigator.mediaDevices?.addEventListener?.("devicechange", revive);
    // A context whose clock stands still while it says it's running has lost its speaker.
    let clock = -1;
    const watch = setInterval(() => {
      revive();
      if (isRunning() && ctx!.currentTime === clock) rebuild();
      clock = isRunning() ? ctx!.currentTime : -1;
    }, 5000);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("focus", revive);
      document.removeEventListener("visibilitychange", revive);
      navigator.mediaDevices?.removeEventListener?.("devicechange", revive);
      clearInterval(watch);
    };
  }, []);
  return on;
}

const TV_CHANNEL = "bkc-tv-sound";
const TV_BEAT_MS = 2000;

/** The TV window tells the operator screen whether its sound is on. */
export function useTvSoundBeacon(on: boolean) {
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(TV_CHANNEL);
    const beat = () => channel.postMessage(on);
    beat();
    const timer = setInterval(beat, TV_BEAT_MS);
    return () => {
      clearInterval(timer);
      channel.close();
    };
  }, [on]);
}

/** On the operator screen: true while an open TV window says its sound is off. */
export function useTvSoundOff(): boolean {
  const [off, setOff] = useState(false);
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(TV_CHANNEL);
    let gone: ReturnType<typeof setTimeout> | undefined;
    channel.onmessage = (e) => {
      setOff(e.data === false);
      clearTimeout(gone);
      // No word any more: the window is closed (or asleep), so there's nothing to say about it.
      gone = setTimeout(() => setOff(false), TV_BEAT_MS * 4);
    };
    return () => {
      clearTimeout(gone);
      channel.close();
    };
  }, []);
  return off;
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

/** A sound this late after its moment says the wrong thing: better silent. */
const LATE_MS = 600;

/** Plays `sound` now, if sound is unlocked; if it just fell asleep, as soon as it's back. */
function play(sound: (c: AudioContext, t: number) => void) {
  const c = ctx;
  if (!c) return;
  if (c.state === "running") return sound(c, c.currentTime + 0.02);
  const asked = performance.now();
  void c.resume().then(
    () => {
      notify();
      if (c === ctx && performance.now() - asked < LATE_MS) sound(c, c.currentTime + 0.02);
    },
    () => {},
  );
}

/** 3, 2, 1: a soft mid pip. */
export const playTick = () => play((c, t) => pip(c, E5, t, 0.24, 0.12, 0.2));

/** "Start!" after a countdown: one high pip, an octave above the ticks, 1.3 seconds in all. */
export const playGo = () => play((c, t) => pip(c, E6, t, 0.2, 0.79, 0.5));

/** A WSA series ends or is paused: three short low tones, like archery's three blasts for "stop". */
export const playSeriesEnd = () =>
  play((c, t) => {
    for (let i = 0; i < 3; i++) pip(c, C5, t + i * 0.38, 0.3, 0.18, 0.14);
  });
