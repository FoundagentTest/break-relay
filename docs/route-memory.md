# Route memory design

Route learning is deliberately small and local. The browser keeps at most 24
completed-route records containing the selected need, duration, space mode,
originating relay-space ID, configured station/action context, which arrival and same-place quiet phases
were reached or skipped,
extension use, the explicit outcome, and completion time. There is no account,
analytics request, score, streak, or visible history view.

Only explicit `useful` and `not_fit` outcomes affect preference weighting.
Unrated routes still help avoid an immediate repeat, but do not count for or
against a station. Transition, generic comfortable-pause, return, and extension
phases are never learning inputs. Skipped and unreached action phases are
excluded from outcome weighting, including when a route ends early or the
browser catches up across cues that were never shown.

Assembly filters history to the originating relay space before ranking, so
same-named or repeated preset stations in another space cannot affect it.
Assembly is deterministic for the same stations, context, history, and seed.
Recent primary-station and action-copy penalties provide variety.
Context-weighted, recency-decayed feedback modestly changes station/action
ranking, while a seeded exploration path regularly ignores preference weights.
Feedback is bounded and never permanently suppresses a configured, mode-safe
station. Version 1 route-history records migrate to the deterministic default
space so existing learning remains useful without leaking into later spaces.
