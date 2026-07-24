# Break Relay

A calm, local-only route away from the screen and back.

Production: [https://break-relay.vercel.app](https://break-relay.vercel.app)

## Run and validate

Node 20 or newer is recommended.

```bash
npm ci
npm run dev
```

Before publishing:

```bash
npm test
npm run build
npm run preview
```

The production build includes the manifest, icons, and service worker in
`dist/`. The build stamps the service worker with the current asset fingerprint;
an installed app keeps working offline and offers an in-app refresh when a new
worker is waiting.

## Deploy

The repository is linked to the Vercel project `break-relay`. Publish the tested
working tree with:

```bash
vercel --prod
```

Keep the stable `break-relay.vercel.app` alias on the production deployment and
leave SSO deployment protection disabled so the product remains public.

Break Relay has no backend, accounts, geolocation, analytics, or runtime
secrets. Named relay spaces, shared launch preferences, an unfinished relay,
and a bounded space-aware route-learning history are stored only in browser
`localStorage`. Route history can be erased across all spaces without removing
saved stations; resetting local data clears every space, session, and history
record.

Route composition uses distinct move, arrival, quiet, and return phases. Longer
boundaries add quiet at one suitable place instead of padding quick actions or
inventing extra travel; see [docs/route-composition.md](docs/route-composition.md).

Saved places remain intact across movement-mode changes. Per-break availability,
bounded live replacement, no-travel fallback, recovery, and neutral learning
are documented in
[docs/availability-and-rerouting.md](docs/availability-and-rerouting.md).
The local space model, migration, unique station identity, and session
isolation are documented in [docs/relay-spaces.md](docs/relay-spaces.md).
