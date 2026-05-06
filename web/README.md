# SloanLED Distributor Portal (web)

Next.js 15 web portal for SloanLED Europe distributors and HQ. Lives alongside the Expo mobile
app in `../app/` and shares the same Supabase project (auth, Postgres, RLS, storage).

## Hierarchy

```
SloanLED HQ (superadmin)
   └── Distributor (distributor_admin / distributor_user)
         └── Signmaker company (admin / employee)   ← uses the mobile app
                └── Employees
```

The web portal is for **distributors** and **HQ**. Signmaker accounts (`admin`, `employee`) are
redirected to a "use the mobile app" message at login.

## Setup

```bash
cd web
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (same project as mobile)
npm install
npm run dev
```

Open http://localhost:3000.

Apply the new migration to Supabase before running for the first time:

```bash
# from repo root
supabase db push
# or apply web/../supabase/migrations/20260506120000_distributor_portal.sql manually
```

## What's in the schema migration

`supabase/migrations/20260506120000_distributor_portal.sql` adds:

- `distributors` table
- `companies.distributor_id` (signmaker → distributor)
- `profiles.distributor_id` and two new roles: `distributor_admin`, `distributor_user`
- `document_views` (audit log; mobile + web can write to it)
- `ai_request_log` (Voiceflow / Luxa AI request summary)
- RLS policies so distributors only see their own signmakers, HQ sees everything
- `current_role()` and `current_distributor_id()` SECURITY DEFINER helpers
  (avoids the recursive RLS pattern that has bitten this repo before)

## Stack

- Next.js 15 App Router + React 19
- TypeScript (strict)
- Tailwind CSS
- `@supabase/ssr` for cookie-based auth
- `lucide-react` icons

No NestJS in the loop — the portal talks to Supabase directly and lets RLS enforce access.

## Project structure

```
web/
├── src/
│   ├── app/
│   │   ├── (dashboard)/         protected pages, share sidebar+topbar
│   │   │   ├── layout.tsx       loads profile, builds shell
│   │   │   ├── page.tsx         /         overview KPIs + recent activity
│   │   │   ├── signmakers/      list + [id] drilldown
│   │   │   ├── projects/
│   │   │   ├── documents/       view leaderboard + recent
│   │   │   └── distributors/    superadmin only
│   │   ├── login/               public
│   │   ├── auth/callback/       Supabase OAuth/magic-link return
│   │   ├── globals.css
│   │   └── layout.tsx           root
│   ├── components/              sidebar, topbar, ui primitives
│   ├── lib/
│   │   ├── supabase/            client / server / middleware factories
│   │   ├── auth.ts              getSessionProfile() — redirect-on-failure
│   │   └── utils.ts
│   ├── types/database.ts        hand-written types (replace with `supabase gen types`)
│   └── middleware.ts            auth guard for all non-public routes
└── ...
```

## Adding a distributor user manually

Until an invite UI exists, provision in Supabase:

1. Create a row in `distributors`.
2. Invite the user via Supabase Auth (or `supabase.auth.admin.inviteUserByEmail`).
3. Once their `profiles` row exists (created by the `handle_new_user` trigger), set
   `role = 'distributor_admin'` and `distributor_id = <the distributor id>`.
4. Assign signmakers: set `companies.distributor_id` to that distributor's id.

## Notes

- Document-view tracking from the mobile app: the mobile app must `INSERT` into
  `document_views` when a user opens a document. RLS already permits any authenticated
  user to insert their own row.
- Same for `ai_request_log` — log a row each time the Voiceflow assistant is invoked.
- For >100 signmakers per distributor, replace the in-memory aggregations on the
  signmakers list page with a SQL view.
