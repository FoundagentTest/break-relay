import type {
  Feeling,
  Preferences,
  RouteStep,
  SpaceMode,
  Station,
  StationKind,
} from "./types";

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

const ACTIONS: Record<Feeling, Record<StationKind, string[]>> = {
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

export const DEFAULT_PREFERENCES: Preferences = {
  stations: [],
  feeling: "noise",
  duration: 7,
  spaceMode: "any",
  audioEnabled: true,
  hasOnboarded: false,
};

function stableChoice<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function stationScore(id: string, seed: number) {
  let score = seed | 0;
  for (const character of id) {
    score = Math.imul(score ^ character.charCodeAt(0), 16777619);
  }
  return score >>> 0;
}

export function buildRoute(
  stations: Station[],
  feeling: Feeling,
  durationMinutes: number,
  seed = Date.now(),
): RouteStep[] {
  const chosen = [...stations]
    .sort((a, b) => stationScore(a.id, seed) - stationScore(b.id, seed))
    .slice(0, Math.min(4, stations.length));

  const totalSeconds = durationMinutes * 60;
  const returnSeconds = 40;
  const stationSeconds = Math.floor((totalSeconds - returnSeconds) / chosen.length);
  const feelingLabel = FEELINGS.find((item) => item.id === feeling)?.label ?? "";

  const steps: RouteStep[] = chosen.map((station, index) => {
    const options = ACTIONS[feeling][station.kind] ?? ACTIONS[feeling].custom;
    const action = stableChoice(options, seed + index * 13 + station.name.length);
    return {
      id: `${station.id}-${index}`,
      station,
      action,
      spokenCue: `${station.name}. ${action}`,
      durationSeconds: stationSeconds,
      kind: "station",
    };
  });

  steps.push({
    id: "return",
    station: {
      id: "desk-return",
      name: "Return point",
      kind: "rest",
      detail: "A bounded return",
      modes: ["any", "small", "seated"],
    },
    action: `Make your way back at an easy pace. Your ${feelingLabel.toLowerCase()} relay is complete.`,
    spokenCue:
      "This is your return cue. Make your way back at an easy pace. Your break relay is complete.",
    durationSeconds:
      totalSeconds - stationSeconds * chosen.length || returnSeconds,
    kind: "return",
  });

  return steps;
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
    spokenCue: `Two quiet minutes. ${action}`,
    durationSeconds: 120,
    kind: "extension",
  };
}
