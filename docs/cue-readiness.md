# Device-local cue readiness

Break Relay treats the local wall clock and saved route as durable. It does not
describe notification, alarm, background-audio, or locked-screen delivery as
established.

## Launch contract

- The baseline sound is a short WAV embedded in the application bundle, so it
  is available in the offline PWA shell. Ordinary phases use one soft note and
  the return boundary uses a distinct two-note sound.
- An enabled sound path is ready only after the launch gesture receives an
  actual `playing` event. `Audio` API presence is not enough.
- Speech is optional. The speech API may be present without a working system
  dispatcher, so voice becomes verified only on the utterance `start` callback.
  A speech failure disables voice without taking down the chime or visual path.
- Chosen screen wake is requested from the same launch gesture. The session is
  not created until the request returns a live sentinel. A rejection leaves the
  user in readiness with direct fallback copy and no running clock.
- Successful checks are stored locally for seven days with a capability
  signature. Staleness, signature changes, a chime failure, or a wake failure
  forces review. A recent check preserves Home's one-action launch, but that
  action still plays the first real chime and re-requests chosen screen wake.

Visual-only launch is an explicit fallback. Readiness shows the exact projected
local return time, says that Relay has not created an alarm or notification,
and provides one-action copy text with concise device-timer guidance.

## Session delivery and recovery

The session stores the IDs of automatically issued phase cues plus one final
cue marker. Reconciliation skips obsolete phases and can issue only the current
phase. Manual “Repeat cue” remains an explicit user action.

Actual chime, speech, and wake failures are separate persisted facts. A chime
failure stops later automatic chime attempts, a speech failure leaves chime and
visual delivery intact, and a wake failure invalidates remembered wake
readiness.

`deadlineAt` is absolute. Pausing holds route cues but does not move the return
time. Rerouting also preserves it. Extensions get a new two-minute active
deadline while retaining `originalDeadlineAt` as provenance for the first
boundary.

## Private handoff

The fragment payload continues to contain only the route and place snapshot.
Cue and wake options come from the receiver's local preferences, are verified
on the receiver, and are never copied from the sender. Guest-session failures
and completion do not change receiver preferences, named spaces, or route
history.
