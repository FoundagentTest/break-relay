# Local relay spaces

Relay spaces are local routing contexts, not accounts or profiles. Up to six
named spaces live in the existing preferences record. Each owns only a station
map and movement mode. Need, duration, spoken-cue choice, screen-wake choice,
launch review, and capability state remain shared.

The first space is created implicitly as `My space`. A version 1 preference
record migrates its complete station array and movement mode into this
deterministic default space. Legacy route history is assigned to the same ID,
and legacy active sessions continue through the version 6 session migrator.
There is no setup question about spaces before the first relay.

Saved station IDs are unique across every space. New preset instances and
custom stations are namespaced by the owning space; duplication remaps every
station. The normalizer also repairs colliding IDs in stored or corrupted data.
Preset identity is retained separately so the setup UI can recognize a
repeated preset without sharing its learning identity.

Home reads stations, compatibility, availability, movement mode, route
composition, and no-travel fallback only from the active space. Switching is a
single labeled selector action and clears temporary availability without
changing either map. Creating an empty space selects it and enters focused
station setup; cancelling leaves a valid no-travel space. Deleting requires
confirmation, selects a surviving space when necessary, removes that space’s
route memory, and cannot remove the final space.

Launch snapshots the originating space in `ActiveSession.spaceSnapshot`.
Rerouting uses the snapshotted eligible stations, completion records the
snapshotted space ID, and extensions use the original need. A later saved-space
switch—even from another tab—cannot rewrite a live route. Full local reset
removes preferences, every space, the active session, and all route history.

No space name or station leaves `localStorage`. Relay does not request
geolocation, infer a location, create an account, add a backend, or sync across
devices.
