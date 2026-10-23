import { useEffect, useRef, useState, type ReactNode } from "react";
import { CLUB_TIME_ZONE } from "@/components/public/format";

/** The canvas in rem: 1920×1080 at the default 16px root size. */
const W = 120;
const H = 67.5;

/** A fixed 120×67.5rem canvas (1920×1080 at the default root size), scaled to fit any screen; cursor hidden when idle; one-click fullscreen. */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(0.5);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const fit = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setScale(Math.min(window.innerWidth / (W * rem), window.innerHeight / (H * rem)));
    };
    fit();
    window.addEventListener("resize", fit);
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 2500);
    };
    wake();
    window.addEventListener("mousemove", wake);
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("mousemove", wake);
      document.removeEventListener("fullscreenchange", onFs);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 overflow-hidden bg-[#e9e9e4] text-ink ${idle ? "cursor-none" : ""}`}
      onDoubleClick={() => document.documentElement.requestFullscreen?.()}
    >
      <div
        style={{ width: `${W}rem`, height: `${H}rem`, transform: `translate(-50%, -50%) scale(${scale})` }}
        className="absolute left-1/2 top-1/2 box-border flex origin-center flex-col gap-8 bg-background px-20 pb-14 pt-12"
      >
        {children}
      </div>
      {!fullscreen && !idle && (
        <button
          type="button"
          onClick={() => document.documentElement.requestFullscreen?.()}
          className="absolute right-4 top-4 cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          Volledig scherm
        </button>
      )}
    </div>
  );
}

export function TopBar({ name, phase, progress }: { name: string; phase?: string | null; progress?: ReactNode }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex flex-none items-center gap-12">
      <span className="text-[2rem] font-bold tracking-[0.2em]">BKC</span>
      <span className="truncate text-[2rem] text-muted">{name}</span>
      <div className="flex-1" />
      {phase && <span className="text-[2rem] font-semibold">{phase}</span>}
      {progress}
      <span className="ml-6 text-[2rem] tabular-nums text-muted">{time}</span>
    </header>
  );
}

export function Gap({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-6 pl-0.5 text-[1.75rem] leading-none tracking-[0.3em] text-plate">
      ···{text && <span className="text-[1.375rem] tracking-normal text-muted">{text}</span>}
    </div>
  );
}

/**
 * A list that fits stays put. One that doesn't shows a page of whole rows, rests long enough to read
 * it, fades to the next page and loops: no row is ever shown cut in half, also when rows differ in
 * height (the winner larger). The pause and the final standings use it.
 */
export function Marquee({ children, className = "flex-1", gap = "gap-1" }: { children: ReactNode; className?: string; gap?: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const window_ = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const vp = viewport.current;
    const tr = track.current;
    if (!vp || !tr) return;
    const measure = () => setOverflow(tr.offsetHeight > vp.clientHeight + 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(tr);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const vp = viewport.current;
    const win = window_.current;
    const tr = track.current;
    if (!vp || !win || !tr) return;
    const reset = () => {
      tr.style.transform = "";
      win.style.height = "";
      win.style.marginBottom = "";
      win.style.opacity = "";
    };
    if (!overflow) return reset();
    // Measured on the page, so in px: where each row starts and ends in the list. Layout offsets, not
    // screen boxes: the TV canvas is scaled as a whole, and heights are set in unscaled px.
    const rows = () => [...tr.children].map((r) => ({ top: (r as HTMLElement).offsetTop, bottom: (r as HTMLElement).offsetTop + (r as HTMLElement).offsetHeight }));
    /** Shows the whole rows that fit from row `first` on; returns the row after them. */
    const show = (first: number) => {
      const all = rows();
      const top = all[first]?.top ?? 0;
      let last = first;
      while (last + 1 < all.length && all[last + 1].bottom - top <= vp.clientHeight + 1) last++;
      tr.style.transform = `translateY(${-top}px)`;
      win.style.height = `${all[last].bottom - top}px`;
      return { next: last + 1 < all.length ? last + 1 : 0, count: last - first + 1 };
    };
    // A page keeps its top edge in one place, also in a centred box.
    win.style.marginBottom = "auto";
    win.style.transition = "opacity 450ms ease";
    let page = show(0);
    let timer: ReturnType<typeof setTimeout>;
    // About two seconds a name, at least four seconds a page.
    const rest = (count: number) => Math.max(4000, 2000 * count);
    const flip = () => {
      win.style.opacity = "0";
      timer = setTimeout(() => {
        page = show(page.next);
        win.style.opacity = "1";
        timer = setTimeout(flip, rest(page.count));
      }, 450);
    };
    timer = setTimeout(flip, rest(page.count));
    return () => {
      clearTimeout(timer);
      reset();
    };
  }, [overflow]);

  return (
    <div ref={viewport} className={`min-h-0 overflow-hidden ${className}`}>
      <div ref={window_} className="overflow-hidden">
        <div ref={track} className={`relative flex flex-col ${gap}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Centered({
  kicker,
  title,
  sub,
  bar,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  bar?: { label: string; names: string; meta: string } | null;
}) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center gap-7 px-5">
        {kicker && <span className="self-start rounded-full bg-yellow px-[1.625rem] py-2 text-[2.125rem] font-bold">{kicker}</span>}
        <span className="text-balance text-[10.625rem] font-semibold leading-[0.95] tracking-[-0.04em] tabular-nums">{title}</span>
        {sub && <span className="max-w-[87.5rem] text-pretty text-[2.5rem] text-muted">{sub}</span>}
      </div>
      {bar && (
        <div className="flex flex-none items-center gap-14 rounded-[2.75rem] bg-ink px-16 py-11 text-white">
          <span className="whitespace-nowrap rounded-full bg-yellow px-[1.625rem] py-2 text-[2.125rem] font-bold text-ink">{bar.label}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <span className="text-balance text-[4.25rem] font-semibold leading-[1.05] tracking-[-0.03em]">{bar.names}</span>
            <span className="text-[2rem] text-white/60">{bar.meta}</span>
          </div>
        </div>
      )}
    </>
  );
}
