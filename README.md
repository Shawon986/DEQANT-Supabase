# DEQANT Fragrance — Supabase + Vercel

Luxury perfume storefront for DEQANT, retaining the original storefront design, brand assets, catalogue presentation, cart, cash-on-delivery checkout, order confirmation and tracking. The complete application data layer is Supabase PostgreSQL, Supabase Auth and Supabase Storage. Vercel serves the static React application. There is no external legacy backend.

## Stack

- React 19, TypeScript, Vite, React Router, TanStack Query
- Supabase Auth (email/password), PostgreSQL, PostgREST RPC and Storage
- PostgreSQL Row Level Security and security-definer checkout/cart functions
- Vercel static deployment with SPA rewrites and security headers

## Features & Functions

- Existing DEQANT storefront, responsive product cards, collection pages, product details, search and filters
- Customer registration, sign-in and sign-out; admin role is granted only by an owner in Supabase SQL
- Glassmorphism administrator studio for products, multiple images, full descriptions, fragrance notes/family, category, sizes, prices, original prices, SKU, stock, merchandising flags and draft/publish status
- Published products appear in the same existing storefront product-card design; unpublished products remain private to admins
- Persistent guest cart, server-side stock and price validation, transactional cash-on-delivery order placement, idempotency key, inventory decrement, order confirmation and phone-verified tracking
- Admin order list and status updates
- Delivery zones, website settings and contact messages stored in PostgreSQL
- Product images stored in a public Supabase Storage bucket; uploads are admin-only and restricted to JPG/PNG/WebP up to 8 MB

## 1. Requirements

- Node.js 20.19+ (or a current Node 22 LTS release)
- A Supabase project
- A Vercel account and a Git repository

## 2. Configure Supabase

1. Create a new Supabase project.
2. Open **SQL Editor → New query**.
3. Paste and run the entire file `supabase/migrations/20261102000100_deqant_full_supabase.sql`. It creates the schema, RLS policies, storage bucket, cart/checkout/tracking RPCs and the original eight starter perfumes.
4. In Supabase **Authentication → Providers → Email**, enable email/password. For launch, keep email confirmation enabled and configure SMTP so confirmation/reset emails are delivered reliably.
5. In **Authentication → URL Configuration**, set Site URL to your production domain and add your Vercel preview and local development URLs to Redirect URLs.
6. Register your own customer account at `/login`. Confirm the email if confirmation is enabled.
7. In SQL Editor, grant the first admin role to that exact account:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL';
```

Never add a public admin-registration form. New signups are always `customer`. Admin access is enforced by PostgreSQL RLS and Storage policies, not by a client-side flag.

## 3. Local development

```bash
cp .env.example .env.local
# Set the two values below from Supabase → Project Settings → API
npm install
npm run check
npm run build
npm run dev
```

`.env.local` values:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
```

Use the project URL and the Supabase anon/public key only. Do **not** put a Supabase `service_role` or secret key in a `VITE_` variable, source file, Git repository or browser. The browser key is safe only because RLS is enabled and all privileged operations are protected by policies or narrowly scoped RPCs.

## 4. Vercel deployment

1. Push this project to GitHub/GitLab.
2. In Vercel, import the repository. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Project Settings → Environment Variables for Production, Preview and Development.
4. Deploy.
5. Add your final Vercel custom domain to Supabase Auth → URL Configuration → Site URL and allowed Redirect URLs.
6. Test a new customer registration, login, admin login, product image upload, product publish, storefront visibility, cart, checkout, stock decrement, order success and tracking.

`vercel.json` includes SPA fallback rewrites, immutable caching for built assets and baseline security headers.

## 5. Product publishing workflow

1. Sign in using the admin account and open `/admin`.
2. Choose **Add perfume**.
3. Enter name, slug, brand, category, family, fragrance notes, full description and one or more product images.
4. Enter variants one per line in this format: `size ml, price, original price, stock, SKU`. Example: `10,1250,1500,20,DEQANT-10ML`.
5. Select merchandising flags and choose **Publish immediately**, or save as a draft.
6. Published products use the same 9:11 image ratio and existing product-card layout as the original collection.

## 6. Security and operational notes

- PostgreSQL RLS is enabled on all application tables. The first admin role must be assigned manually by the project owner.
- The Supabase service-role key is not used by the frontend and must never be exposed.
- Cart tables are not directly accessible to anonymous clients. Cart and checkout actions go through constrained SQL functions. The cart UUID is a bearer capability; keep it private and do not log it.
- Checkout calculates prices from database rows, locks variant rows, validates stock, decrements stock and writes order snapshots in one database transaction. Repeated submissions with the same idempotency UUID return the same order.
- Order tracking requires both order number and matching phone number. Sensitive order data is returned only through the narrowly scoped phone-verification RPC. Rate limits are persisted in PostgreSQL rather than held in a single server process.
- Contact form submissions are validated and rate-limited in PostgreSQL.
- Public product images are intentionally readable; upload/update/delete policies require the admin role.
- Configure Supabase SMTP, backups, point-in-time recovery and monitoring according to your production traffic and retention requirements. Review the Supabase plan's database, storage and bandwidth limits.
- Cash on delivery is the only payment method currently implemented. No online payment gateway is implied.

## 7. Verification checklist

```bash
npm run check
npm run build
npm run lint
```

Then verify in a real browser and a deployed preview: guest browsing; customer sign-up and sign-in; unauthorized `/admin` denial; admin image upload; product draft/publish/unpublish/edit; storefront product card sizing; variant price and stock; cart reload persistence; checkout duplicate submission; stock concurrency; order success; tracking with incorrect and correct phone numbers; mobile layout; and Supabase Auth confirmation/reset emails.

A successful local build is not a substitute for testing against your actual Supabase project. The deployment is ready for configuration and verification, but cannot be declared live/production-verified until the owner supplies Supabase credentials, runs the migration, configures Auth URLs/SMTP and completes the live tests.
