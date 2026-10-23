"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, type ReactNode } from "react";
import {
  competitionProgress,
  competitionSchedule,
  groupName,
  groupsInShootingOrder,
  isShootingStatus,
  knockoutPlan,
  pendingShootoffs,
  phaseDone,
  roundTitle,
  setupFor,
  tvName,
  heatKey,
  type CompetitionState,
} from "@/lib/competition";
import { ACTIVE_COMPETITION_KEY, getMeta, type LiveRecord } from "@/lib/offline/db";
import { useLocalCompetition } from "@/lib/offline/store";
import { useQueryParam } from "@/lib/offline/url";
import { HeatProgress } from "@/components/heat-progress";
import { CLUB_TIME_ZONE } from "@/components/public/format";
import { Centered, Stage, TopBar } from "./parts/frame";
import { heatMeta, heatNames, LiveHeat, LiveLine } from "./parts/heat";
import { Pause, Warmup } from "./parts/pause";
import { Podium } from "./parts/podium";
import { ShootoffLive, ShootoffWaiting } from "./parts/shootoff";

export function TvApp() {
  const fromUrl = useQueryParam("c");
  const active = useLiveQuery(() => getMeta(ACTIVE_COMPETITION_KEY), []);
  const competitionId = fromUrl ?? active ?? null;
  const local = useLocalCompetition(competitionId);

  return (
    <Stage>
      {local ? (
        <Screen state={local.state} live={local.live} />
      ) : (
        <>
          <TopBar name="" />
          <Centered
            title="BKC Wedstrijden"
            sub={local === null || (fromUrl === null && active === undefined) ? "Open het TV-scherm vanuit de wedstrijdleiding op dit toestel." : ""}
          />
        </>
      )}
    </Stage>
  );
}

const PHASE_LABEL: Record<CompetitionState["status"], string> = {
  prepared: "",
  warmup: "Opwarming",
  round1: "Ronde 1",
  break: "Pauze",
  round2: "Ronde 2",
  semifinal: "Halve finale",
  final: "Finale",
  shootoff: "Afkamping",
  finished: "Einde wedstrijd",
};

const longDay = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long", timeZone: CLUB_TIME_ZONE });
const welcomeDate = (date: string) => {
  const s = longDay.format(new Date(`${date}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function Screen({ state, live }: { state: CompetitionState; live: LiveRecord | undefined }) {
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);
  const focusIndex = live?.focus ? schedule.findIndex((h) => heatKey(h) === live.focus!.heatKey) : -1;
  const heatIndex = focusIndex >= 0 ? focusIndex : progress.heatIndex;
  const phaseIndex = focusIndex >= 0 ? live!.focus!.phaseIndex : (progress.phaseIndex ?? 0);
  const heat = heatIndex === null ? null : schedule[heatIndex];
  const comp = state.snapshot.competition;
  const firstUp = heat ? { label: "Als eerste", names: heatNames(state, heat), meta: heatMeta(state, heat) } : null;
  const shooting = isShootingStatus(state.status) && heat;
  const lastRound = schedule.at(-1)?.round ?? comp.rounds;

  let body: ReactNode;
  switch (state.status) {
    case "prepared": {
      const n = [...state.entries.values()].filter((e) => !e.withdrawn).length;
      const sub = [welcomeDate(comp.date), comp.location, n > 0 ? `${n} schutters ingeschreven` : null].filter(Boolean).join(" · ");
      body = <Centered kicker="Welkom" title={comp.name} sub={sub} bar={n > 0 ? firstUp : null} />;
      break;
    }
    case "warmup":
      body = live?.pauseEndsAt ? <Warmup end={live.pauseEndsAt} bar={firstUp} /> : <Centered title="Opwarming" bar={firstUp} />;
      break;
    case "break":
      body = <Pause state={state} live={live} schedule={schedule} heat={heat} />;
      break;
    case "shootoff":
      body = live?.shootoff ? <ShootoffLive state={state} draft={live.shootoff} /> : <ShootoffWaiting state={state} />;
      break;
    case "finished":
      // For the prize-giving: the top three of every group (after a knockout final: its podium).
      body = <Podium state={state} kicker="Einde wedstrijd" title={state.format.knockout?.final ? "Podium" : "Eindstand"} />;
      break;
    default: {
      const cut = pendingShootoffs(state).find((p) => p.stage);
      // Round 1 is shot and the operator hasn't chosen between a break and going on yet.
      const between = heat && focusIndex < 0 && phaseDone(state, heat.round);
      body = between ? (
        <Centered kicker={comp.name} title={`${PHASE_LABEL[state.status]} is klaar`} sub="Zo meteen gaan we verder." bar={firstUp} />
      ) : heat ? (
        setupFor(state, heat.groupCode, heat.round).entry === "points" ? (
          <LiveLine state={state} live={live} schedule={schedule} heatIndex={heatIndex!} />
        ) : (
          <LiveHeat state={state} live={live} schedule={schedule} heatIndex={heatIndex!} phaseIndex={Math.min(phaseIndex, heat.phases.length - 1)} />
        )
      ) : cut ? (
        <Centered
          kicker="Afkamping"
          title="Gelijke stand op de grens"
          bar={{ label: groupName(state, cut.groupCode), names: cut.groups[0].map((e) => tvName(state, e)).join(" & "), meta: "De afkamping beslist wie verder mag" }}
        />
      ) : state.format.knockout?.final && groupsInShootingOrder(state).every((g) => knockoutPlan(state, g.code).done) ? (
        <Podium state={state} kicker={comp.name} />
      ) : (
        <Centered kicker={comp.name} title="Alle beurten geschoten" sub="De uitslag volgt." />
      );
    }
  }

  return (
    <>
      <TopBar
        name={comp.name}
        phase={shooting ? null : PHASE_LABEL[state.status]}
        progress={
          shooting ? (
            <HeatProgress
              variant="tv"
              rounds={schedule.map((h) => h.round)}
              current={progress.heatIndex}
              endLabel={roundTitle(state, lastRound)}
              className="w-[47.5rem]"
            />
          ) : null
        }
      />
      {body}
    </>
  );
}
