# SubPath Vercel Deployment Verification

## Verification Summary
* **Verification Date**: 2026-10-08
* **Repository**: `SubPath-Protocol/subpath-app`
* **Deployed Commit SHA**: `aec64adfcf2d1badf549890e0e58fc344f6e49d2`
* **Vercel Deployment URL**: `https://subpath-93n0j5sna-nanicoms-projects.vercel.app`
* **Production URL**: `https://subpath-app.vercel.app`
* **Build Result**: SUCCESS
* **Root Directory Used**: `.` (monorepo root)
* **Install Command Used**: `pnpm install`
* **Build Command Used**: `pnpm --filter @subpath/sdk build && pnpm --filter web build`
* **Output Directory Used**: `.next` (handled automatically by Vercel Next.js builder)

## Build Verification
* **SDK Build**: Succeeded (`@subpath/sdk` compiled via `tsc` with clean type definitions).
* **Next.js Web Build**: Succeeded (Turbopack optimized production build, 5/5 routes generated).
* **GitHub Actions CI**: Run #41 completed with status `success`.
* **Vercel Deployment Status**: Status `success`, deployment ID `6930214084`.

## Environment Variables Presence Check
No secret values are printed. The following public variables are present and configured in the production deployment:
* `NEXT_PUBLIC_STELLAR_NETWORK`: Present (`testnet`)
* `NEXT_PUBLIC_STELLAR_RPC_URL`: Present (`https://soroban-testnet.stellar.org`)
* `NEXT_PUBLIC_STELLAR_PASSPHRASE`: Present (`Test SDF Network ; September 2015`)
* `NEXT_PUBLIC_SUBPATH_CONTRACT_ID`: Present (`CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3`)

## Live Routes Verification
All live routes return HTTP 200 with zero server errors, zero generic error pages, and complete CSS/JS asset bundles:
* `/`: HTTP 200 (Home landing page, hero section, features, navigation)
* `/dashboard`: HTTP 200 (Merchant dashboard, plan creation UI, plan list)
* `/plans/1`: HTTP 200 (Dynamic subscription checkout page for Plan 1)
* `/plans/2`: HTTP 200 (Dynamic subscription checkout page for Plan 2)
* `/plans/3`: HTTP 200 (Dynamic subscription checkout page for Plan 3)

## Client Assets & Configuration Verification
* **Contract ID**: Verified present in live deployed JS bundles (`CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3`).
* **Stellar Network**: Verified configured for Stellar Testnet (`Test SDF Network ; September 2015`).
* **Multi-Wallet Support**: Verified loaded in live deployed bundles with support for Freighter, Albedo, xBull, Lobstr, Rabet, and Hana.

## Known Limitations
* Automated recurring billing is executed by the background executor daemon (`apps/executor`) and event indexer daemon (`apps/indexer`), which run in a persistent worker environment rather than serverless functions.
* Vercel hosts the web frontend application (`apps/web`), which directly interfaces with Stellar Soroban Testnet RPC and wallet providers.
