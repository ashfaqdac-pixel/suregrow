# SureGrow — Cloudflare Pages + Workers + D1 (Steps 1–5)
Includes:
1) What‑If Simulator
2) Cows / Measurements / Sell Cow
3) PDF Reports (Investor Statement, Founder Batch Report)
4) Authentication (Cloudflare Access) + Roles (owner/member/viewer)
5) Wallets & Categories with live balances

## Deploy (free)
1) **D1**: Create `suregrow` → run `db/schema.sql`
2) **API (Workers)**:
   - Set `database_id` in `api/wrangler.toml`.
   - `cd api && npm i`
   - `npx wrangler d1 execute suregrow --file=../db/schema.sql`
   - `npx wrangler deploy`
3) **Pages**: connect repo → Root=`web`, Build=`npm ci && npm run build`, Output=`web/dist`
4) **Proxy**: Pages route `/api/*` → Workers service (suregrow-api)
5) **Access**: Zero-Trust → protect the domain; first user to call API becomes owner.

Tune ROI corridors and 60/40 split in `api/wrangler.toml`.
