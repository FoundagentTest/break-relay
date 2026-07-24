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
