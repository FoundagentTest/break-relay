import type {
  Feeling,
  Preferences,
  RouteHistoryEntry,
  RouteStep,
  SpaceMode,
  Station,
  StationKind,
} from "./types";
import { initialRelaySpace } from "./spaces";

export const FEELINGS: {
  id: Feeling;
  label: string;
  short: string;
  symbol: string;
}[] = [
  {
    id: "noise",
    label: "Mental noise",
    short: "Give thoughts somewhere to settle",
    symbol: "≈",
  },
  {
    id: "eyes",
    label: "Tired eyes",
    short: "Trade screen distance for real distance",
    symbol: "◉",
  },
  {
    id: "stiff",
    label: "Physical stiffness",
    short: "Invite a little comfortable movement",
    symbol: "↝",
  },
  {
    id: "air",
    label: "Need air",
    short: "Find a change in atmosphere",
    symbol: "〰",
  },
];

export const SPACE_MODES: {
  id: SpaceMode;
  label: string;
  description: string;
}[] = [
  { id: "any", label: "A few rooms", description: "A short route is possible" },
  { id: "small", label: "One room", description: "Keep every stop close" },
  {
    id: "seated",
    label: "Low movement",
    description: "Seated and close-reach options",
  },
];

export const STATION_PRESETS: Station[] = [
  {
    id: "window",
    name: "Window or view",
    kind: "view",
    detail: "Look beyond the screen",
    modes: ["any", "small", "seated"],
  },
  {
    id: "water",
    name: "Water stop",
    kind: "water",
    detail: "Tap, bottle, or carafe",
    modes: ["any", "small", "seated"],
  },
  {
    id: "doorway",
    name: "Doorway",
    kind: "threshold",
    detail: "A small change of scene",
    modes: ["any", "small"],
  },
  {
    id: "clear-floor",
    name: "Clear floor",
    kind: "movement",
    detail: "A safe patch to stand or move",
    modes: ["any", "small"],
  },
  {
    id: "hallway",
    name: "Hallway",
    kind: "movement",
    detail: "An easy out-and-back",
    modes: ["any"],
  },
  {
    id: "outside",
    name: "Outside step",
    kind: "threshold",
    detail: "Only when safe and available",
    modes: ["any"],
  },
  {
    id: "plant",
    name: "Plant or shelf",
    kind: "nature",
    detail: "A nearby detail to notice",
    modes: ["any", "small", "seated"],
  },
  {
    id: "quiet-corner",
    name: "Quiet corner",
    kind: "rest",
    detail: "A spot that feels different",
    modes: ["any", "small"],
  },
  {
    id: "turned-chair",
    name: "Chair turned away",
    kind: "rest",
    detail: "A new direction, no travel",
    modes: ["small", "seated"],
  },
  {
    id: "open-door",
    name: "Open doorway view",
    kind: "view",
    detail: "A longer sightline from your seat",
    modes: ["small", "seated"],
  },
  {
    id: "nearby-surface",
    name: "Nearby surface",
    kind: "nature",
    detail: "An object within easy reach",
    modes: ["seated"],
  },
  {
    id: "resting-position",
    name: "Resting position",
    kind: "rest",
    detail: "Your comfortable alternate posture",
    modes: ["seated"],
  },
];

const ARRIVAL_ACTIONS: Record<Feeling, Record<StationKind, string[]>> = {
  noise: {
    view: [
      "Let your gaze land on one still thing in the distance. Nothing to solve.",
      "Find three quiet shapes beyond the glass or across the room.",
    ],
    water: [
      "Pour or take a slow drink. Notice the temperature, then let that be enough.",
      "Refill what you use for water and take one unhurried sip.",
    ],
    threshold: [
      "Pause at the change of space. Notice one sound from farther away.",
      "Cross the threshold if it is safe, then simply notice what feels different.",
    ],
    movement: [
      "Take an easy out-and-back at your own pace. Leave the work where it is.",
      "Move through the clear space once, as slowly or briefly as feels useful.",
    ],
    nature: [
      "Notice one small texture or edge here. Stay with just that detail.",
      "Look for one irregular shape. Let your attention rest there.",
    ],
    rest: [
      "Face away from your work. Let the next minute have no assignment.",
      "Settle into a comfortable position and listen for the quietest sound.",
    ],
    custom: [
      "Arrive here and notice one ordinary detail you usually pass by.",
      "Let this place hold your attention for a moment. Nothing else is required.",
    ],
  },
  eyes: {
    view: [
      "Look toward the farthest comfortable point you can see. Let your focus soften.",
      "Trace the outline of something distant with your eyes, without straining.",
    ],
    water: [
      "Take a slow drink, then look past the nearest object toward a farther one.",
      "Refill your water. While you wait, blink gently and look beyond your hand.",
    ],
    threshold: [
      "Look through the opening toward the longest easy sightline available.",
      "Pause here and alternate once between a near edge and a farther object.",
    ],
    movement: [
      "Move through the space once while looking ahead, not down at a screen.",
      "Take an easy lap and let the room, rather than a display, fill your view.",
    ],
    nature: [
      "Follow the outer edge of a leaf or object, then look beyond it.",
      "Notice its color, then let your eyes relax into the whole scene.",
    ],
    rest: [
      "Close your eyes if comfortable, or soften your gaze away from the screen.",
      "Face a blank or distant view and give your eyes a quiet minute.",
    ],
    custom: [
      "Look around this place slowly, choosing distance over detail.",
      "Let your gaze move off the screen and settle somewhere comfortable.",
    ],
  },
  stiff: {
    view: [
      "Settle by the view. If comfortable, loosen your shoulders once and let them drop.",
      "Stand or sit in an easy position and gently change where your weight rests.",
    ],
    water: [
      "Refill or lift your water in the easiest way available. Take a slow sip.",
      "Take a drink, then unclench your hands and let your arms rest.",
    ],
    threshold: [
      "Move to the threshold at a comfortable pace. Pause with an easy, tall posture.",
      "Change rooms or simply face the opening—whichever feels safe and comfortable.",
    ],
    movement: [
      "Take a short, easy lap. Keep every movement within your comfortable range.",
      "Shift position or move through the clear space in whatever way suits your body.",
    ],
    nature: [
      "Rest your hands, then turn gently toward this detail without pushing your range.",
      "Approach or face this spot and let your posture change naturally.",
    ],
    rest: [
      "Choose a different comfortable posture. Let supported parts of you feel supported.",
      "Turn away from the desk and make one small adjustment that feels easier.",
    ],
    custom: [
      "Change position here in the smallest way that feels comfortable.",
      "Arrive at your own pace and let your working posture go for a moment.",
    ],
  },
  air: {
    view: [
      "If it is comfortable, notice the light and air here. No need to open anything.",
      "Look outward and notice one sign of weather or changing light.",
    ],
    water: [
      "Take a cool or room-temperature drink, whatever is available.",
      "Refill your water and notice the air on your skin while you pause.",
    ],
    threshold: [
      "If conditions are safe, step through or open the space. Otherwise, enjoy the change of view.",
      "Pause at the boundary and notice whether the air or sound changes.",
    ],
    movement: [
      "Take an easy out-and-back and notice the air changing as you move.",
      "Move once through the space at a comfortable pace, breathing normally.",
    ],
    nature: [
      "Notice how light falls on this spot. Stay with the change in color.",
      "Look for a small sign of the world beyond your work.",
    ],
    rest: [
      "Turn toward the most open part of the room and breathe normally.",
      "Settle facing away from the desk and notice the air already around you.",
    ],
    custom: [
      "Notice what is different about the light, air, or sound in this place.",
      "Pause here and let the change of scene do the work.",
    ],
  },
};

const QUIET_ACTIONS: Record<
  Feeling,
  Record<"view" | "nature" | "rest", [string, string]>
> = {
  noise: {
    view: [
      "Let your attention rest on one distant, still thing. The quiet does not need a task.",
      "Keep the screen behind you and take in the whole view without looking for anything.",
    ],
    nature: [
      "Stay with one ordinary texture or edge, then let the rest of the scene be quiet.",
      "Let this small detail hold your attention loosely. Nothing needs to be worked out.",
    ],
    rest: [
      "Let this position be enough for a while. The next cue will come to you.",
      "Stay facing away from the work if that remains comfortable. Leave the time unassigned.",
    ],
  },
  eyes: {
    view: [
      "Keep your gaze at a comfortable distance, or close your eyes if you prefer.",
      "Let the view stay wide and easy. There is nothing small to inspect.",
    ],
    nature: [
      "Take in the whole shape rather than its fine detail, with an easy gaze.",
      "Look beyond this detail when comfortable and let your focus rest farther away.",
    ],
    rest: [
      "Keep your eyes closed or softly focused away from the screen, whichever is easier.",
      "Let your gaze remain quiet and comfortable until the return cue.",
    ],
  },
  stiff: {
    view: [
      "Stay in the easiest position available here. Change it whenever that feels better.",
      "Let your working posture stay behind you; no position needs to be held.",
    ],
    nature: [
      "Rest here without holding a pose. A small comfortable adjustment is always optional.",
      "Let supported parts of you stay supported while your attention rests on the scene.",
    ],
    rest: [
      "Settle into the support that is available. Move or adjust whenever you want.",
      "Keep the position only while it feels comfortable. Let the quiet remain unassigned.",
    ],
  },
  air: {
    view: [
      "Stay with the light or sense of space here. Breathe normally and let the scene change on its own.",
      "Notice one small change in light, weather, or sound, then let the view be quiet.",
    ],
    nature: [
      "Let the color and light here hold your attention without searching for more.",
      "Stay with this small sign of the world beyond work until the next cue.",
    ],
    rest: [
      "Face the more open direction if that suits you, and notice the air already around you.",
      "Stay with the change of direction. Nothing needs to be opened or adjusted.",
    ],
  },
};

export const DEFAULT_PREFERENCES: Preferences = {
  version: 2,
  spaces: [initialRelaySpace()],
  activeSpaceId: "space-default",
  feeling: "noise",
  duration: 7,
  audioEnabled: true,
  keepAwake: false,
  alwaysReviewLaunch: false,
  launchSetupComplete: false,
  launchNeedsReview: false,
  capabilitySnapshot: null,
  hasOnboarded: false,
};

function stationScore(id: string, seed: number) {
  let score = seed | 0;
  for (const character of id) {
    score = Math.imul(score ^ character.charCodeAt(0), 16777619);
  }
  return score >>> 0;
}

function seededUnit(seed: number, key: string) {
  return stationScore(key, seed) / 0xffffffff;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function contextSimilarity(
  entry: RouteHistoryEntry,
  feeling: Feeling,
  durationMinutes: number,
  spaceMode: SpaceMode,
) {
  const feelingWeight = entry.feeling === feeling ? 1 : 0.18;
  const spaceWeight =
    entry.spaceMode === spaceMode
      ? 1
      : entry.spaceMode === "any" || spaceMode === "any"
        ? 0.72
        : 0.5;
  const durationDifference = Math.abs(
    entry.durationMinutes - durationMinutes,
  );
  const durationWeight =
    durationDifference === 0 ? 1 : durationDifference <= 2 ? 0.78 : 0.56;
  return feelingWeight * spaceWeight * durationWeight;
}

function feedbackValue(outcome: RouteHistoryEntry["outcome"]) {
  if (outcome === "useful") return 1;
  if (outcome === "not_fit") return -0.68;
  return 0.08;
}

function preferenceForStation(
  stationId: string,
  history: RouteHistoryEntry[],
  feeling: Feeling,
  durationMinutes: number,
  spaceMode: SpaceMode,
) {
  const score = history.reduce((total, entry, index) => {
    const stationSteps = entry.steps.filter(
      (item) => item.stationId === stationId,
    );
    const used = stationSteps.some((item) => item.used && !item.skipped);
    const skipped = stationSteps.some((item) => item.skipped);
    if (!used && !skipped) return total;
    const evidence =
      (used ? feedbackValue(entry.outcome) : 0) +
      (skipped ? -0.24 : 0);
    return (
      total +
      evidence *
        contextSimilarity(entry, feeling, durationMinutes, spaceMode) *
        (1 / (1 + index * 0.22))
    );
  }, 0);
  return clamp(score, -2.2, 3);
}

function preferenceForAction(
  stationId: string,
  action: string,
  history: RouteHistoryEntry[],
  feeling: Feeling,
  durationMinutes: number,
  spaceMode: SpaceMode,
) {
  const score = history.reduce((total, entry, index) => {
    const steps = entry.steps.filter(
      (item) =>
        item.stationId === stationId &&
        item.action === action,
    );
    const used = steps.some((item) => item.used && !item.skipped);
    const skipped = steps.some((item) => item.skipped);
    if (!used && !skipped) return total;
    const evidence =
      (used ? feedbackValue(entry.outcome) : 0) +
      (skipped ? -0.32 : 0);
    return (
      total +
      evidence *
        contextSimilarity(entry, feeling, durationMinutes, spaceMode) *
        (1 / (1 + index * 0.22))
    );
  }, 0);
  return clamp(score, -2.2, 3);
}

export interface RouteBuildOptions {
  history?: RouteHistoryEntry[];
  spaceMode?: SpaceMode;
  spaceId?: string;
}

export function stationsForSpaceMode(
  stations: Station[],
  spaceMode: SpaceMode,
) {
  return stations.filter(
    (station) =>
      Array.isArray(station.modes) &&
      station.modes.includes(spaceMode),
  );
}

export function availableStations(
  stations: Station[],
  spaceMode: SpaceMode,
  excludedStationIds: Iterable<string> = [],
) {
  const excluded = new Set(excludedStationIds);
  return stationsForSpaceMode(stations, spaceMode).filter(
    (station) => !excluded.has(station.id),
  );
}

const QUIET_KINDS = new Set<StationKind>(["view", "nature", "rest"]);

function isQuietStation(station: Station) {
  return QUIET_KINDS.has(station.kind);
}

function uniqueStationOrder(entry: RouteHistoryEntry) {
  return entry.steps.reduce<string[]>((order, step) => {
    if (!order.includes(step.stationId)) order.push(step.stationId);
    return order;
  }, []);
}

function quietAffinity(feeling: Feeling, kind: StationKind) {
  const affinity: Record<Feeling, Partial<Record<StationKind, number>>> = {
    noise: { rest: 3, nature: 2.7, view: 2.6 },
    eyes: { view: 3, rest: 2.8, nature: 2.4 },
    stiff: { rest: 3, nature: 2.3, view: 2 },
    air: { view: 3, nature: 2.7, rest: 2.2 },
  };
  return affinity[feeling][kind] ?? 0;
}

function activeAffinity(feeling: Feeling, kind: StationKind) {
  const affinity: Record<Feeling, Partial<Record<StationKind, number>>> = {
    noise: { water: 2.8, threshold: 2.1, movement: 1.8, custom: 1.4 },
    eyes: { threshold: 2.6, movement: 2.2, water: 2, custom: 1.4 },
    stiff: { movement: 3, threshold: 2.2, water: 1.6, custom: 1.3 },
    air: { threshold: 3, movement: 2.6, water: 1.8, custom: 1.5 },
  };
  return affinity[feeling][kind] ?? 0;
}

function transitionSeconds(spaceMode: SpaceMode) {
  if (spaceMode === "seated") return 15;
  if (spaceMode === "small") return 22;
  return 35;
}

function returnSeconds(spaceMode: SpaceMode) {
  if (spaceMode === "seated") return 40;
  if (spaceMode === "small") return 50;
  return 70;
}

function arrivalSeconds(kind: StationKind) {
  const durations: Record<StationKind, number> = {
    view: 45,
    water: 35,
    threshold: 45,
    movement: 75,
    nature: 45,
    rest: 35,
    custom: 45,
  };
  return durations[kind];
}

function moveAction(
  station: Station,
  spaceMode: SpaceMode,
  legIndex: number,
) {
  const lead = legIndex === 0 ? "Begin" : "Next";
  if (spaceMode === "seated") {
    return `${lead} by staying seated if you prefer. Turn or reach toward ${station.name} in the easiest way available.`;
  }
  if (spaceMode === "small") {
    return `${lead} by turning away from the screen and going to ${station.name} if comfortable. Keep this leg within the room.`;
  }
  return `${lead} by leaving the screen behind and making your way to ${station.name} at a comfortable pace.`;
}

function chooseAction({
  choices,
  station,
  phaseIndex,
  history,
  feeling,
  durationMinutes,
  spaceMode,
  seed,
  exploring,
}: {
  choices: string[];
  station: Station;
  phaseIndex: number;
  history: RouteHistoryEntry[];
  feeling: Feeling;
  durationMinutes: number;
  spaceMode: SpaceMode;
  seed: number;
  exploring: boolean;
}) {
  const immediateActions =
    history[0]?.steps
      .filter((item) => item.stationId === station.id)
      .map((item) => item.action) ?? [];
  const ranked = choices
    .map((action) => ({
      action,
      score:
        seededUnit(
          seed,
          `action:${phaseIndex}:${station.id}:${action}`,
        ) +
        (exploring
          ? 0
          : preferenceForAction(
              station.id,
              action,
              history,
              feeling,
              durationMinutes,
              spaceMode,
            ) * 0.3) -
        (immediateActions.includes(action) ? 0.72 : 0),
    }))
    .sort(
      (a, b) => b.score - a.score || a.action.localeCompare(b.action),
    );
  return (
    ranked.find((item) => !immediateActions.includes(item.action))?.action ??
    ranked[0].action
  );
}

export function buildRoute(
  stations: Station[],
  feeling: Feeling,
  durationMinutes: number,
  seed = Date.now(),
  options: RouteBuildOptions = {},
): RouteStep[] {
  return composeRoute(
    stations,
    feeling,
    durationMinutes,
    durationMinutes * 60,
    seed,
    options,
    { revision: 0, flexibleReturn: false },
  );
}

interface CompositionRuntime {
  revision: number;
  flexibleReturn: boolean;
  startingStationId?: string;
}

function targetStationCount(
  durationMinutes: number,
  spaceMode: SpaceMode,
  eligibleCount: number,
) {
  if (durationMinutes <= 5 || spaceMode === "seated") return 1;
  if (spaceMode === "small") {
    return durationMinutes >= 10 ? Math.min(2, eligibleCount) : 1;
  }
  return Math.min(durationMinutes >= 10 ? 3 : 2, eligibleCount);
}

function composeRoute(
  stations: Station[],
  feeling: Feeling,
  durationMinutes: number,
  requestedSeconds: number,
  seed: number,
  options: RouteBuildOptions,
  runtime: CompositionRuntime,
): RouteStep[] {
  const spaceMode = options.spaceMode ?? "any";
  const history = (options.history ?? [])
    .filter(
      (entry) => !options.spaceId || entry.spaceId === options.spaceId,
    )
    .sort(
    (a, b) => b.completedAt - a.completedAt,
    );
  const eligible = stationsForSpaceMode(stations, spaceMode);
  if (eligible.length === 0) {
    throw new Error("A relay needs at least one station available in this space.");
  }
  const hasRatedHistory = history.some((entry) => entry.outcome !== "unrated");
  const exploring =
    hasRatedHistory && stationScore("deliberate-exploration", seed) % 5 === 0;
  const recentOrders = history
    .slice(0, 3)
    .map(uniqueStationOrder);

  function ranked(
    candidates: Station[],
    position: number,
    selected: Station[] = [],
  ) {
    const selectedKinds = new Set(selected.map((station) => station.kind));
    const ordered = candidates
      .map((station) => {
      const preference = exploring
        ? 0
        : preferenceForStation(
            station.id,
            history,
            feeling,
            durationMinutes,
            spaceMode,
          );
      const recentPenalty = exploring
        ? 0
        : recentOrders.reduce(
          (penalty, order, recentIndex) =>
              penalty +
              (order[position] === station.id
                ? 0.9 / (recentIndex + 1)
                : order.includes(station.id)
                  ? 0.16 / (recentIndex + 1)
                  : 0),
            0,
          );
      return {
        station,
        score:
            seededUnit(seed, `station:${position}:${station.id}`) +
            (exploring
              ? 0
              : isQuietStation(station)
                ? quietAffinity(feeling, station.kind)
                : activeAffinity(feeling, station.kind)) +
            preference * 0.3 -
            recentPenalty -
            (selectedKinds.has(station.kind) ? 0.32 : 0),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.station.id.localeCompare(b.station.id),
      )
      .map((item) => item.station);
    if (
      !exploring &&
      ordered.length > 1 &&
      recentOrders[0]?.[position] === ordered[0].id
    ) {
      return [ordered[1], ordered[0], ...ordered.slice(2)];
    }
    return ordered;
  }

  const quietCandidates = eligible.filter(isQuietStation);
  const activeCandidates = eligible.filter(
    (station) => !isQuietStation(station),
  );
  const requestedCount = targetStationCount(
    durationMinutes,
    spaceMode,
    eligible.length,
  );
  const startingStation = runtime.startingStationId
    ? eligible.find((station) => station.id === runtime.startingStationId)
    : undefined;
  let sequence: Station[] = [];

  if (startingStation) {
    sequence.push(startingStation);
  }

  if (startingStation && isQuietStation(startingStation)) {
    sequence = [startingStation];
  } else if (requestedCount === 1) {
    if (sequence.length === 0) {
      sequence = [
        ranked(
          quietCandidates.length > 0 ? quietCandidates : activeCandidates,
          0,
        )[0],
      ];
    }
  } else {
    const quietCarrier = ranked(
      quietCandidates.filter(
        (station) => station.id !== startingStation?.id,
      ),
      requestedCount - 1,
      sequence,
    )[0];
    const leadTarget = Math.max(
      0,
      requestedCount - (quietCarrier ? 1 : 0),
    );
    while (sequence.length < leadTarget) {
      const remaining = eligible.filter(
        (station) =>
          station.id !== quietCarrier?.id &&
          !sequence.some((item) => item.id === station.id),
      );
      if (remaining.length === 0) break;
      const activeRemaining = remaining.filter(
        (station) => !isQuietStation(station),
      );
      sequence.push(
        ranked(
          activeRemaining.length > 0 ? activeRemaining : remaining,
          sequence.length,
          sequence,
        )[0],
      );
    }
    if (quietCarrier) sequence.push(quietCarrier);
    while (sequence.length < requestedCount) {
      const remaining = eligible.filter(
        (station) => !sequence.some((item) => item.id === station.id),
      );
      if (remaining.length === 0) break;
      sequence.push(
        ranked(remaining, sequence.length, sequence)[0],
      );
    }
  }

  sequence = sequence.filter(
    (station, index, items) =>
      items.findIndex((item) => item.id === station.id) === index,
  );

  const totalSeconds = Math.max(1, Math.floor(requestedSeconds));
  const preferredReturn = returnSeconds(spaceMode);
  const returnDuration = runtime.flexibleReturn
    ? totalSeconds <= preferredReturn + 60
      ? Math.max(20, Math.min(preferredReturn, Math.floor(totalSeconds * 0.5)))
      : preferredReturn
    : preferredReturn;
  const minimumCarry = runtime.flexibleReturn ? 20 : 60;

  function beginsHere(station: Station) {
    return (
      sequence[0]?.id === station.id &&
      runtime.startingStationId === station.id
    );
  }

  function fixedSeconds(items: Station[], arrivals: number[]) {
    return items.reduce(
      (seconds, station, index) =>
        seconds +
        (index === 0 && beginsHere(station)
          ? 0
          : transitionSeconds(spaceMode)) +
        arrivals[index],
      returnDuration,
    );
  }

  function minimumFixedSeconds(items: Station[]) {
    return fixedSeconds(
      items,
      items.map(() => 20),
    );
  }

  let arrivalDurations = sequence.map((station) =>
    arrivalSeconds(station.kind),
  );
  while (
    sequence.length > 1 &&
    minimumFixedSeconds(sequence) + minimumCarry > totalSeconds
  ) {
    const carrierIsQuiet = isQuietStation(sequence.at(-1)!);
    const removeIndex = carrierIsQuiet
      ? startingStation &&
        sequence[0].id === startingStation.id &&
        sequence.length > 2
        ? sequence.length - 2
        : 0
      : sequence.length - 1;
    sequence.splice(removeIndex, 1);
    arrivalDurations.splice(removeIndex, 1);
  }

  let excess =
    fixedSeconds(sequence, arrivalDurations) + minimumCarry - totalSeconds;
  for (let index = 0; excess > 0 && index < arrivalDurations.length; index += 1) {
    const reducible = Math.max(0, arrivalDurations[index] - 20);
    const reduction = Math.min(excess, reducible);
    arrivalDurations[index] -= reduction;
    excess -= reduction;
  }

  if (
    sequence.length === 0 ||
    excess > 0 ||
    fixedSeconds(sequence, arrivalDurations) >= totalSeconds
  ) {
    if (runtime.flexibleReturn) {
      return buildNoTravelRouteForSeconds(
        feeling,
        spaceMode,
        totalSeconds,
        runtime.revision,
      );
    }
    throw new Error("This relay boundary is too short for a safe route arc.");
  }

  const feelingLabel = FEELINGS.find((item) => item.id === feeling)?.label ?? "";
  const suffix = routeSuffix(runtime.revision);
  const steps: RouteStep[] = [];

  sequence.forEach((station, index) => {
    if (!(index === 0 && beginsHere(station))) {
      const move = moveAction(station, spaceMode, index);
      steps.push({
        id: `${station.id}-move${suffix}`,
        station,
        action: move,
        spokenCue: `${index === 0 ? "First stop" : "Next stop"}: ${station.name}. ${move}`,
        durationSeconds: transitionSeconds(spaceMode),
        phase: "move",
      });
    }
    const arrival = chooseAction({
      choices:
        ARRIVAL_ACTIONS[feeling][station.kind] ??
        ARRIVAL_ACTIONS[feeling].custom,
      station,
      phaseIndex: index * 2 + 1,
      history,
      feeling,
      durationMinutes,
      spaceMode,
      seed,
      exploring,
    });
    steps.push({
      id: `${station.id}-arrive${suffix}`,
      station,
      action: arrival,
      spokenCue: `At ${station.name}. ${arrival}`,
      durationSeconds: arrivalDurations[index],
      phase: "arrive",
    });
  });

  const carrySeconds =
    totalSeconds -
    steps.reduce((seconds, step) => seconds + step.durationSeconds, 0) -
    returnDuration;
  const carrier = sequence.at(-1)!;
  if (isQuietStation(carrier)) {
    const action = chooseAction({
      choices:
        QUIET_ACTIONS[feeling][
          carrier.kind as "view" | "nature" | "rest"
        ],
      station: carrier,
      phaseIndex: sequence.length * 2,
      history,
      feeling,
      durationMinutes,
      spaceMode,
      seed,
      exploring,
    });
    steps.push({
      id: `${carrier.id}-quiet${suffix}`,
      station: carrier,
      action,
      spokenCue: `Quiet carry at ${carrier.name}. ${action} No screen check is needed until the return cue.`,
      durationSeconds: carrySeconds,
      phase: "quiet",
    });
  } else {
    const action = noTravelAction(feeling);
    steps.push({
      id: `comfortable-pause-quiet${suffix}`,
      station: {
        id: "comfortable-pause",
        name: "No-travel pause",
        kind: "rest",
        detail: "No real quiet-capable place is available",
        modes: ["any", "small", "seated"],
      },
      action,
      spokenCue: `No quiet-capable place remains in this route. ${action} No screen check is needed until the return cue.`,
      durationSeconds: carrySeconds,
      phase: "quiet",
    });
  }

  steps.push({
    id: `return${suffix}`,
    station: {
      id: "desk-return",
      name: "Return window",
      kind: "rest",
      detail: "A bounded return",
      modes: ["any", "small", "seated"],
    },
    action: `Make your way back at an easy pace. Your ${feelingLabel.toLowerCase()} relay is complete.`,
    spokenCue:
      "Return phase. Make your way back at an easy pace. This return window ends at your break boundary.",
    durationSeconds: returnDuration,
    phase: "return",
  });

  return steps;
}

function routeSuffix(revision: number) {
  return revision > 0 ? `-reroute-${revision}` : "";
}

function noTravelAction(feeling: Feeling) {
  const actions: Record<Feeling, string> = {
    noise:
      "Turn away from the screen or settle where you are. Let the time have no assignment.",
    eyes:
      "Turn away from the screen or close your eyes if comfortable. No other place is needed.",
    stiff:
      "Choose the easiest supported position available now. No movement or held pose is required.",
    air:
      "Face a different direction if comfortable and notice the light or air already around you.",
  };
  return actions[feeling];
}

function buildNoTravelRouteForSeconds(
  feeling: Feeling,
  spaceMode: SpaceMode,
  totalSeconds: number,
  revision: number,
): RouteStep[] {
  const suffix = routeSuffix(revision);
  const seconds = Math.max(1, Math.floor(totalSeconds));
  const preferredReturn = returnSeconds(spaceMode);
  const returnDuration =
    seconds <= preferredReturn + 20
      ? seconds
      : preferredReturn;
  const pauseDuration = seconds - returnDuration;
  const route: RouteStep[] = [];
  if (pauseDuration > 0) {
    const action = noTravelAction(feeling);
    route.push({
      id: `comfortable-pause-quiet${suffix}`,
      station: {
        id: "comfortable-pause",
        name: "No-travel pause",
        kind: "rest",
        detail: "No travel or assumed destination",
        modes: ["any", "small", "seated"],
      },
      action,
      spokenCue: `No travel is needed. ${action}`,
      durationSeconds: pauseDuration,
      phase: "quiet",
    });
  }
  route.push({
    id: `return${suffix}`,
    station: {
      id: "desk-return",
      name: "Return window",
      kind: "rest",
      detail: "A bounded return",
      modes: ["any", "small", "seated"],
    },
    action:
      pauseDuration > 0
        ? "Return when you are ready. The original break boundary is unchanged."
        : "No place is required. Turn away comfortably, or return when you are ready.",
    spokenCue:
      pauseDuration > 0
        ? "Return phase. Return when you are ready. The original break boundary is unchanged."
        : "No travel is needed. Turn away comfortably, or return when you are ready.",
    durationSeconds: returnDuration,
    phase: "return",
  });
  return route;
}

export function buildNoTravelRoute(
  feeling: Feeling,
  durationMinutes: number,
  spaceMode: SpaceMode,
  revision = 0,
) {
  return buildNoTravelRouteForSeconds(
    feeling,
    spaceMode,
    durationMinutes * 60,
    revision,
  );
}

export interface ReplacementRoute {
  route: RouteStep[];
  destination: Station | null;
}

export function buildReplacementRoute(
  stations: Station[],
  feeling: Feeling,
  durationMinutes: number,
  remainingSeconds: number,
  seed: number,
  options: RouteBuildOptions & {
    revision: number;
    startingStationId?: string;
  },
): ReplacementRoute {
  const spaceMode = options.spaceMode ?? "any";
  const eligible = stationsForSpaceMode(stations, spaceMode);
  const revision = Math.max(1, options.revision);
  const wholeSeconds = Math.max(1, Math.floor(remainingSeconds));

  if (eligible.length === 0) {
    return {
      route: buildNoTravelRouteForSeconds(
        feeling,
        spaceMode,
        wholeSeconds,
        revision,
      ),
      destination: null,
    };
  }

  const route = composeRoute(
    eligible,
    feeling,
    durationMinutes,
    wholeSeconds,
    seed,
    options,
    {
      revision,
      flexibleReturn: true,
      startingStationId: options.startingStationId,
    },
  );
  const destination =
    route.find(
      (step) =>
        step.station.id !== "comfortable-pause" &&
        step.station.id !== "desk-return",
    )?.station ?? null;
  return { route, destination };
}

export function buildExtension(feeling: Feeling): RouteStep {
  const actions: Record<Feeling, string> = {
    noise: "Stay where you are. Listen for the farthest sound, then the nearest.",
    eyes: "Keep your gaze away from the screen and let it rest at a comfortable distance.",
    stiff:
      "Stay in your easiest position. Make any small adjustment your body is asking for.",
    air: "Stay with the change of scene and notice the air or light around you.",
  };
  const action = actions[feeling];
  return {
    id: "extension",
    station: {
      id: "stay",
      name: "Two quiet minutes",
      kind: "rest",
      detail: "No new destination",
      modes: ["any", "small", "seated"],
    },
    action,
    spokenCue: `Quiet extension. ${action}`,
    durationSeconds: 120,
    phase: "extension",
  };
}
