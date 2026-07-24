# Private device handoff

Break Relay can prepare a route on one device and carry it to another without
an account or backend. The existing local Begin action is unchanged.

## Lifecycle

1. The source composes the route immediately from the active named space,
   current need and boundary, route memory, movement mode, and temporary place
   availability.
2. Preparing the handoff does not create an `ActiveSession`, start a clock, or
   play a cue. It creates only an in-memory transfer snapshot and a QR/link.
3. The receiver captures and validates the URL fragment, then replaces the
   current history entry without the fragment before showing a preview.
4. Only **Start on this device** creates the durable local session and plays
   the first real cue. Receiver speech, vibration, and wake-lock capability are
   detected afresh and source launch settings are not transferred.
5. The received session uses the normal recovery, pause, reroute, no-travel
   fallback, early-end, extension, and completion paths.

Transfers expire after 15 minutes. Regeneration preserves the exact prepared
route while issuing a new identity and time window.

## Payload and privacy boundary

The payload is a zlib-compressed, base64url-encoded JSON document after
`#relay=`. Fragments are not included in HTTP requests. No space name, station,
prompt, or route is placed in a Relay path or query string.

The schema is versioned and rejects unknown top-level or nested keys. Validation
also bounds compressed input, decompressed output, strings, collection sizes,
timestamps, duration, route phases, station identity, temporary exclusions, and
the exact summed route boundary. Unsupported, expired, malformed, tampered, or
oversized material reaches a non-mutating recovery screen.

The encoded payload is capped at 2,700 characters so a production-origin URL
fits in a low-error-correction QR code. Decompressed JSON is capped at 32 KiB.
QR and link creation happen entirely in the client.

## Local isolation and honest limits

Received sessions carry `source: "handoff"`. This provenance survives storage
recovery, reroutes, and extension. It prevents the guest route from entering
route memory and avoids changing launch preferences after receiver capability
failures. Receiving does not create, rename, import, select, or overwrite a
Relay space.

Because there is no backend, Relay does not claim delivery acknowledgement,
cross-device synchronization, remote control, or enforceable single use. The UI
asks the user to start on one receiving device and treat the QR as private.

The service worker already caches the complete versioned application shell.
Since navigation requests never include the fragment, a receiver with the
current shell cached can capture and run a handoff offline.
