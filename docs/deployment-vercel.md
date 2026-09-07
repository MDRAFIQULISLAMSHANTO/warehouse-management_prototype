# Deployment to Vercel

The prototype is a static single-page application. There is no backend, no
database and no server-side rendering, so deployment is a static build plus one
rewrite rule.

## What is already configured

`vercel.json` in the project root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

The rewrite is the important part. Without it, a direct link or a browser refresh
on a detail route such as `/pallets/pal_000012` or a filtered list such as
`/pallets?q=...` would return a 404, because those paths do not exist as files.
With it, every path serves `index.html` and React Router resolves the route on
the client. **Deep links and detail-page refreshes therefore work in production.**

## Option A — Vercel CLI

```bash
npm i -g vercel        # once
vercel login

cd ispahani-wms
vercel                 # preview deployment
vercel --prod          # production deployment
```

Accept the detected framework (Vite). Build command and output directory come
from `vercel.json`.

## Option B — Git integration

1. Push this directory to a Git repository.
2. In the Vercel dashboard: **Add New → Project**, import the repository.
3. If the repository root is not `ispahani-wms`, set **Root Directory** to
   `ispahani-wms`.
4. Leave Framework Preset as **Vite**. Build command `npm run build`, output
   directory `dist` — both already in `vercel.json`.
5. Deploy. Every push produces a preview URL; the default branch produces
   production.

## Option C — prebuilt upload

```bash
npm run build
vercel deploy --prebuilt
```

## Environment variables

**None.** The prototype deliberately has no secrets, no API keys and no backend
configuration. If a build ever starts asking for one, something has been added
that does not belong in a presales prototype.

## Node version

Developed on Node 24. Vercel's default Node runtime for new projects is
compatible; if you need to pin it, add to `package.json`:

```json
"engines": { "node": ">=20" }
```

## After deploying — check these

1. Open the production URL. It redirects to `/dashboards/stock-visibility`.
2. Navigate to a pallet detail page, then **press F5**. The page must reload
   correctly rather than 404 — this exercises the rewrite.
3. Copy a filtered list URL (one with `?q=...`), open it in a new tab, and
   confirm the facets and grouping are restored.
4. Open `/about/integrity` and confirm every check passes.
5. Check the browser console is free of errors.

## Sharing with the client

The deployment is public by default. If the demonstration data should not be
openly reachable, enable **Vercel Authentication** (Deployment Protection) in
Project Settings so only invited viewers can open it.

Remember that the banner and the "Illustrative demo data" indicator are part of
the deliverable. They should stay visible: they are what keeps a prototype from
being mistaken for a live system.
