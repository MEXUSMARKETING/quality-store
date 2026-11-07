# Quality admin v2 – developer guide

Next.js 14 App Router, TypeScript, Tailwind, `postgres` (postgres.js) on Neon, Vercel Blob for images.
The admin lives in `src/app/admin` and shares the database with the storefront (`src/app/(shop)`).

## Ground rules
- Real data only: read/write through Postgres. No mock data, no fake integrations. If something needs a provider that is not connected (email, WhatsApp, payment), say so honestly in the UI.
- Every write is a **server action** (`"use server"`) that starts with `requireAdmin()` (from `@/lib/auth`), validates input, writes, calls `audit({...})` from `@/lib/admin`, then `revalidatePath(...)`.
- Money is integer shekels. Never use floats for money.
- DB access: `const sql = await db()` from `@/lib/db`; guard reads with `hasDb()` (return empty lists when false). Writes may assume a DB, but return a friendly Hebrew error if `!hasDb()`.
- Schema is created/migrated additively in `src/lib/db.ts` `init()` (`create table if not exists`, `alter table … add column if not exists`). Never drop/rename columns – the live store uses them.
- Do NOT modify storefront files unless your task says so.
- `next.config.mjs` has `typescript.ignoreBuildErrors`, but write correct types anyway.
- In SQL template literals never write backslash escapes (e.g. `\D`) – use `[^0-9]`.

## UI kit (match the approved prototype)
- Page shell, sidebar, top bar & global search: `src/app/admin/_components/Shell.tsx` (already wired in `layout.tsx`). Add nav items there only if told.
- Components in `src/app/admin/_components/ui.tsx`: `PageHeader`, `Chip` (tones green/amber/red/blue/gray/purple), `OrderStatusChip`, `PaymentStatusChip`, `Icon` (+ `ICONS`), `Empty`, `Notice`, `LinkTabs`, `DbMissing`, `fmtDate`, `fmtDateTime`.
- CSS classes (globals.css): `a-card`, `a-btn` (+ `a-btn-primary`, `a-btn-dark`, `a-btn-danger`, `a-btn-sm`), `a-field` (label), `a-input` (input/select/textarea), `a-chip`, `a-table`, `a-tab` (+ `aria-current="page"` / `aria-selected`), `a-count`.
- Tailwind colors: `adm-navy #17243A`, `adm-navy2`, `adm-blue #3478F6`, `adm-link`, `adm-bg #F5F7FB`, `adm-line`, `adm-field`, `adm-text`, `adm-mid`, `adm-muted #5E6B80`.
- Reference implementation: `src/app/admin/page.tsx` (dashboard) and `src/app/admin/search/page.tsx`.
- Hebrew, RTL, accessible: real `<button>`/`<a>`, `<label>` around inputs, `aria-label` on icon buttons, 4.5:1 contrast (use `adm-muted`, never lighter grey for text), touch targets ≥ 36px.
- Prefer server components + URL search params for filters/tabs/pagination; use small client components (`"use client"`) for interactive bits (bulk selection, tabs inside an editor, confirm dialogs, live previews). Confirm destructive actions. Show success feedback (e.g. `?saved=1` banner via `Notice tone="green"`, or `useFormState` result).

## Checking your work (no npm install is possible here)
- `bash /tmp/claude-0/-home-claude/16b709c7-de4e-58ac-b4ab-f861a143cee4/scratchpad/tools/check.sh` → stubbed type check (next/react are `any`) + syntax check of all files. Must end with no errors.
- Don't run `npm`, don't git commit/push – the lead does that.
