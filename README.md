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

Break Relay has no backend, accounts, analytics, or runtime secrets. Preferences
and an unfinished relay are the only data stored, both in browser
`localStorage`. Clearing site data resets them.
