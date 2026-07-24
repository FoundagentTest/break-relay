# Restorative route composition

A relay is a sparse sequence of phases, not a list of equally sized stops:

1. `move` leaves or turns away from the screen toward one configured,
   mode-safe station.
2. `arrive` gives that station one bounded, concrete light action.
3. `quiet` stays at the same view, nature, or rest station. Seven- and
   ten-minute relays divide this time into two distinct prompts at the same
   place.
4. `return` starts 70 seconds before the boundary in a few-rooms route,
   50 seconds before it in one-room mode, and 40 seconds before it in
   low-movement mode.

Water, threshold, movement, and custom stations never receive a padded quiet
hold. If the selected station cannot naturally carry quiet attention, a short
`settle` phase asks the user to choose any comfortable nearby position or turn
where they are; no layout or unconfigured destination is invented. The
remaining quiet uses that generic pause and is excluded from route learning.

The phase durations always sum to the selected 5-, 7-, or 10-minute boundary.
Only one configured destination is used in a relay, which avoids guessing
physical adjacency or creating back-and-forth. Station variety happens across
relays through local history.

Active-session schema version 4 adds the phase name. Versions 1–3 migrate in
place: legacy station steps become `arrive`, legacy return and extension steps
keep their role, and their original deadlines are not rewritten.

Station safety is reconciled before route composition. Changing the space mode
removes selected presets that do not declare support for the new mode, reports
what changed, and requires three safe replacements before setup can continue.
Loaded preferences receive the same filter before the app decides that a
returning route is launch-ready, so an older incompatible selection returns to
setup instead of failing during the one-action launch. New custom places are
scoped to the movement mode in which the user adds them; a custom place added
in low-movement mode may be reused in broader modes, but the reverse is not
assumed.
