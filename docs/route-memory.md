# Route memory design

Route learning is deliberately small and local. The browser keeps at most 24
completed-route records containing the selected need, duration, space mode,
configured station/action context, which stops were reached or skipped,
extension use, the explicit outcome, and completion time. There is no account,
analytics request, score, streak, or visible history view.

Only explicit `useful` and `not_fit` outcomes affect preference weighting.
Unrated routes still help avoid an immediate repeat, but do not count for or
against a station. Skipped and unreached steps are excluded from outcome
weighting, including when a route ends early.

Assembly is deterministic for the same stations, context, history, and seed.
Recent position and action-copy penalties provide variety. Context-weighted,
recency-decayed feedback modestly changes station/action ranking, while a
seeded exploration path regularly ignores preference weights. Feedback is
bounded and never permanently suppresses a configured, mode-safe station.
