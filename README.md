# Break Relay

A calm browser-based break route for desk workers. Pick a few safe places in
your actual space, choose what needs a change and how long you have, then follow
one sparse spoken cue at a time.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. No account, API key, or server is required.
Preferences are stored in the browser under `break-relay-preferences-v1`.

## Validate

```bash
npm test
npm run build
```

The automated flow covers first-time station setup, route tailoring, all primary
session controls, the return boundary, a two-minute extension, persistence,
editing, reset, and exact route duration assembly.
