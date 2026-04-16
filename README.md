# ☕ Cafe Cursor Accra

> Credit distribution for **Cafe Cursor Accra** — a secure way to give pre-approved attendees their Cursor IDE credits.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat-square&logo=tailwind-css)

## ✨ Features

- **Secure registration** — Only pre-approved attendees can claim credits
- **Email notifications** — Credit details via Resend
- **Multi-language** — English and Brazilian Portuguese on the landing page
- **Responsive** — Dark-friendly theme, works on mobile
- **Admin panel** — Credits, eligible users, manual actions
- **Social sharing** — Share to X from the success screen

## 🚀 Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/cafe-cursor.git
cd cafe-cursor
npm install
```

### 2. Environment variables

This app uses **PostgreSQL only** (no SQLite). Use a free database for local dev ([Neon](https://neon.tech), [Supabase](https://supabase.com), etc.).

```bash
cp .env.example .env
```

Edit `.env`:

- **`DATABASE_URL`** — Pooled Postgres URL (if your provider gives separate pool/direct URLs, use the **pooled** one here).
- **`DIRECT_URL`** — Direct (non-pooled) URL — often the same host without pooling params; required for `prisma db push` / migrations on many hosts.
- **`RESEND_API_KEY`** / **`FROM_EMAIL`** — From [Resend](https://resend.com); verify a domain for production sending.
- **`ADMIN_USERNAME`** / **`ADMIN_PASSWORD`** — `/admin` login; use a **strong password** in production.
- **`SESSION_SECRET`** — Long random string for signing admin cookies in production.

### 3. Database

```bash
npx prisma generate
npx prisma db push
```

### 4. Seed data (optional)

Put real data in **`prisma/credits.csv`** and **`prisma/users.csv`** (gitignored), or start from the examples:

```bash
cp prisma/credits-example.csv prisma/credits.csv
cp prisma/users-example.csv prisma/users.csv
# Edit the copies with your referral links and attendee list, then:
npx tsx prisma/seed.ts
```

CSV formats:

**`prisma/credits.csv`** — column `link` with full Cursor referral URLs.

**`prisma/users.csv`** — `email`, `name`, `company`, `approval_status` (use `approved` for eligible rows).

### 5. Development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 📊 Admin panel

- URL: **`/admin`**
- Set credentials via `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`.
- If unset, defaults match [`lib/auth.ts`](lib/auth.ts) (change before production).

## 🌐 Deploy to Vercel

1. Import the repo in the [Vercel dashboard](https://vercel.com).
2. Add the **same** variables as in `.env.example`:

   - `DATABASE_URL`
   - `DIRECT_URL`
   - `RESEND_API_KEY`
   - `FROM_EMAIL`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`

3. Deploy. Use managed Postgres (Vercel Postgres, Neon, Supabase, etc.).
4. After deploy, run **`npx prisma db push`** (or your migration flow) against production **using `DIRECT_URL`** if your host requires it for schema changes.

### Pre-event smoke checks

- Register with an email from your seeded eligible list; confirm a credit is assigned and the Resend email arrives.
- Try an email **not** on the list; confirm the eligibility error.
- Exhaust or temporarily empty credits; confirm the “no credits” path.
- Log into **`/admin`**, review dashboard stats, and try any manual actions you plan to use.
- Open the site on a phone; check the form and success screen.

### Recommended database providers

- **[Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)**
- **[Supabase](https://supabase.com)**
- **[Neon](https://neon.tech)**

## 🛠️ Tech stack

| Technology | Purpose |
|------------|---------|
| [Next.js 14](https://nextjs.org) | App Router |
| [TypeScript](https://www.typescriptlang.org) | Types |
| [Prisma](https://www.prisma.io) | ORM |
| [Tailwind CSS](https://tailwindcss.com) | Styling |
| [Resend](https://resend.com) | Email |
| [Zod](https://zod.dev) | Validation |

## 📁 Project structure

```
cafe-cursor/
├── app/                 # Pages and API routes
├── components/          # React components
├── lib/                 # Auth, email, translations, etc.
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   ├── *-example.csv    # Tracked examples
│   ├── credits.csv      # Local only (gitignored) — your links
│   └── users.csv        # Local only (gitignored) — your attendees
└── public/
```

## 🎨 Customization

Event copy lives in **`lib/translations.ts`**, SEO in **`app/layout.tsx`**, and transactional email in **`lib/email.ts`**.

## 🤝 Contributing

Pull requests are welcome.

## 📄 License

MIT

## 💚 Credits

**Cafe Cursor Accra** — organized with ☕ by **Yaw Antwi Owusu**, Cursor Ambassador **Ghana**.

---

<p align="center">
  <a href="https://cursor.com">
    <img src="https://cursor.com/favicon.ico" width="32" height="32" alt="Cursor" />
  </a>
  <br />
  Powered by <a href="https://cursor.com">Cursor</a>
</p>
