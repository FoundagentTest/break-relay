# Availability and live rerouting

Saved stations and temporary availability are intentionally separate.

- `Preferences.stations` is the durable station map. Changing `spaceMode`
  changes compatibility, never the saved array.
- Home starts with every compatible saved station available. The optional
  “Places available now” control excludes stations only from the next relay.
- `ActiveSession.eligibleStations` snapshots that relay’s available choices.
  `unavailableStationIds`, `rerouteCount`, and the recomposed route are stored
  with the active session only so a reload can recover safely.
- Zero eligible stations produces an exact-duration comfortable-pause and
  return route. One or two stations are valid inputs.

“Place unavailable” is distinct from “Skip this cue.” A place rejection:

1. marks every learnable phase for that station neutral;
2. removes it from the remaining choice set;
3. replaces the remaining route with a new move/arrival/quiet/return arc, or a
   no-travel pause when no safe alternative remains;
4. keeps the session ID and absolute `deadlineAt`;
5. gives every replacement cue a revision-suffixed ID so only the new cue is
   announced.

When replacement happens while paused, phase deadlines are anchored to the
original `pausedAt` value. Resume therefore shifts both the session boundary and
the recomposed phase schedule by the full paused interval, including time that
passed before the replacement action.

Each rejection increments `rerouteCount`, and the count cannot exceed the
session’s eligible-station count. Rejected IDs remain excluded for the session,
so replacement cannot cycle. Terminal completion clears the eligible and
unavailable station snapshots while retaining neutral step IDs long enough to
write an accurate optional route rating.

Session version 5 migrates versions 1–4. Preference loading no longer filters
stations by the current movement mode, which repairs the earlier destructive
mode-switch behavior without changing storage keys or losing saved places.
