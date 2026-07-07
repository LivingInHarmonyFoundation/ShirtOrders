# Institution Shirt Order Manager

A production-ready web app for managing shirt orders for schools and government institutions.

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (PostgreSQL database + Auth)
- **Stripe** (Checkout Sessions, Webhooks)
- **Recharts** (Dashboard charts)

## Setup Instructions

### 1. Install Dependencies

```bash
cd shirt-order-manager
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
# Copy your real values from the Supabase & Stripe dashboards. DO NOT commit real keys.
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Server-only. Bypasses RLS — never expose to the client or commit to git.
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Supabase Database

1. Go to your Supabase project > **SQL Editor**
2. Paste and run the contents of `supabase/migrations/001_initial_schema.sql`

### 4. Create Admin User

1. In Supabase: **Authentication > Users > Add user**
2. Use those credentials at `/admin/login`

### 5. Set Up Stripe Webhooks (Local Dev)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`.

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000

---

## Pages

### Public
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/order` | Order form |
| `/order/checkout` | Payment page |
| `/order/confirmation` | Receipt |

### Admin
| Route | Description |
|-------|-------------|
| `/admin/login` | Sign in |
| `/admin/dashboard` | Stats & charts |
| `/admin/orders` | All orders (search/filter/sort) |
| `/admin/orders/[id]` | Order detail + audit trail |
| `/admin/reports` | Reports + CSV export |
| `/admin/settings` | App configuration |

---

## What Needs Manual Setup

| Item | Where |
|------|-------|
| Supabase project | supabase.com |
| Run SQL migration | Supabase SQL Editor |
| Create admin user | Supabase Auth > Users |
| Stripe account | stripe.com |
| Stripe webhook | Stripe Dashboard or CLI |
| Fill .env.local | .env.local file |

---

## Stripe Webhook Events to Register

- `checkout.session.completed`
- `checkout.session.expired`
- `charge.refunded`

For production, set your webhook URL to: `https://your-domain.com/api/stripe/webhook`
