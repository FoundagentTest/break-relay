# Route composition invariants

Break Relay treats saved stations as individually reachable places, not as a
topology. The composer never infers adjacency or adds an unsaved destination.

## Arc policy

- Five-minute routes use one real carrying place when possible.
- Seven-minute routes in an unconstrained space use up to two complementary
  places.
- Ten-minute routes use up to three places in an unconstrained space and up to
  two in a one-room space.
- Low-movement routes use one place at every boundary.
- When a configured view, nature, or rest station is available, it is the final
  quiet carrier. Active stations such as water, movement, thresholds, and
  custom stops can lead into it.
- When no real quiet carrier is available, real action stops may still form a
  sparse arc, followed by one generated no-travel phase. Generated phases never
  enter route learning.

Each route has one explicit return window and sums exactly to the selected
5/7/10-minute boundary.

## Live recomposition

Rejecting a current or upcoming station excludes it for that session only.
Recomposition uses the exact remaining seconds and retains the original
deadline. When the user has already reached a still-available station, a
replacement can begin there without a redundant travel cue. Paused sessions
use the instant at which the pause began as their schedule reference, so a
reroute does not consume or add paused time.

## Learning

Only real `arrive` and real `quiet` phases are learnable. A phase becomes used
only when the session clock actually reaches it. Explicit skips receive a small
negative weight; completion feedback supplies the stronger contextual weight.
Phases removed by temporary availability rerouting remain neutral, and
generated no-travel, return, move, and extension phases do not pollute station
or action preferences.

## Compatibility and safety

Active-session schema version 7 stores the exact route, originating space
snapshot, temporary exclusions, reroute count, learning context, and pause
clock. Versions 1–6 still migrate in place: legacy station steps become
`arrive`, legacy return and extension steps keep their roles, and existing
deadlines are not rewritten.

Movement-mode compatibility is reconciled before composition. Saved stations
that do not support the active mode remain stored in their named relay space
but are not eligible for that break. New custom places keep the movement scope
in which the user added them; broader reachability is never inferred.
