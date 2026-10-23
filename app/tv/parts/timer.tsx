import { useEffect, useRef, useState } from "react";
import { heatKey, timerStep, type CompetitionState, type TimerStep } from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import type { Heat } from "@/lib/scoring";
import { formatClock, useNow } from "@/components/use-now";

/** The series countdown on the TV, with a beep when a series starts and two when it ends. */
export function TvSeriesTimer({ state, live, heat }: { state: CompetitionState; live: LiveRecord | undefined; heat: Heat }) {
  const timing = state.format.timing!;
  const timer = live?.seriesTimer?.heatKey === heatKey(heat) ? live.seriesTimer : null;
  const now = useNow(250, !!timer);
  const step: TimerStep | null = timer ? timerStep(timing, heat.phases.length, timer, now) : null;
  const sound = useSoundUnlocked();
  useStepBeeps(step);
  const series = heat.phases.length;

  if (!step) {
    return (
      <span className="whitespace-nowrap text-[2rem] text-white/60">
        {series} × {formatClock(timing.seriesSeconds)}
        {!sound && <span className="ml-6 text-[1.375rem] text-white/40">klik op het scherm voor geluid</span>}
      </span>
    );
  }
  if (step.kind === "done") return <span className="whitespace-nowrap text-[2.5rem] font-semibold text-white/70">Reeksen gedaan</span>;
  return (
    <span className="flex items-baseline gap-6 whitespace-nowrap">
      {!sound && <span className="text-[1.375rem] text-white/40">klik op het scherm voor geluid</span>}
      <span className={`text-[2.5rem] font-semibold ${step.kind === "recover" ? "text-yellow" : "text-white/70"}`}>
        {step.kind === "recover" ? "Herstel" : series === 1 ? "Reeks" : `Reeks ${step.series}`}
      </span>
      <span className={`text-[6rem] font-semibold leading-[0.8] tracking-[-0.04em] tabular-nums ${step.kind === "series" && step.left <= 10 ? "text-yellow" : ""}`}>
        {formatClock(step.left)}
      </span>
    </span>
  );
}

// Browsers only play sound after a click on the page; the TV window gets one when it's set up.
let audio: AudioContext | null = null;

function useSoundUnlocked(): boolean {
  const [on, setOn] = useState(() => audio?.state === "running");
  useEffect(() => {
    if (on) return;
    const unlock = () => {
      audio ??= new AudioContext();
      void audio.resume().then(() => setOn(audio!.state === "running"));
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

/** Beeps: `pattern` alternates sound and silence, in ms. */
function beep(pattern: number[]) {
  if (!audio || audio.state !== "running") return;
  let t = audio.currentTime;
  pattern.forEach((ms, i) => {
    if (i % 2 === 0) {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + ms / 1000);
    }
    t += ms / 1000;
  });
}

/** One long beep as a series starts, two short ones as it ends. Not when the TV opens halfway. */
function useStepBeeps(step: TimerStep | null) {
  const key = !step ? "idle" : step.kind === "series" ? `series:${step.series}` : step.kind;
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = key;
    if (was === null || was === key) return;
    if (key.startsWith("series")) beep([700]);
    else if (was.startsWith("series") && (key === "recover" || key === "done")) beep([180, 140, 180]);
  }, [key]);
}
