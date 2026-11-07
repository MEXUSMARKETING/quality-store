# Quality טמרה — חנות אונליין

אתר חנות בעברית (RTL) למגפונים, עם מערכת ניהול: מוצרים ומלאי לפי מידה, הזמנות, ומועדון לקוחות.

**טכנולוגיה:** Next.js 14 (App Router) · Tailwind CSS · Supabase (Postgres + Storage לתמונות) · מערכת ניהול ב־`/admin` (ראו ADMIN-GUIDE.md).

## עמודי האתר
| נתיב | מה יש בו |
|---|---|
| `/` | דף הבית — באנר, קרוסלת סגנונות, קולקציה, תכשיטים/תיקים, מבצע, יתרונות, מועדון לקוחות |
| `/shop` | קולקציה עם סינון (מידה, עקב, צבע, מחיר), מיון וחיפוש (`?q=`) |
| `/product/[slug]` | דף מוצר — בחירת מידה לפי מלאי, הוספה לסל, הזמנה בוואטסאפ |
| `/cart` · `/checkout` | סל קניות והשלמת הזמנה (מזומן בעת המסירה / אשראי טלפוני / Bit) |
| `/order/[number]` | אישור הזמנה |
| `/admin` | מערכת ניהול (מוגנת בסיסמה) |

## העלאה ל־Vercel
1. ב־Vercel: **Add New → Project → Import** את הריפו `quality-store`.
2. ב־**Environment Variables** להוסיף:
   - `ADMIN_PASSWORD` — הסיסמה לכניסה ל־`/admin` (לבחור סיסמה חזקה).
3. **Deploy.** האתר עולה מיד עם 11 המוצרים. בשלב הזה הזמנות נשלחות בוואטסאפ.
4. חיבור Supabase (מסד נתונים + אחסון תמונות, באותו חשבון Supabase של שאר הפרויקטים):
   - ב־Supabase: פרויקט חדש בשם `quality-store`, אזור Frankfurt (eu-central-1).
   - ב־Vercel: **Integrations → Supabase** → לחבר את פרויקט Supabase לפרויקט `quality-store` (מוסיף את `POSTGRES_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` לבד),
     או להוסיף ידנית `DATABASE_URL` (Transaction pooler, פורט 6543), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   - הטבלאות נוצרות אוטומטית בכניסה הראשונה, והמוצרים נטענים אליהן. תיקיית התמונות `products` נוצרת אוטומטית בהעלאה הראשונה.
5. אחרי החיבור: **Deployments → Redeploy**.

## פיתוח מקומי
```bash
cp .env.example .env.local   # למלא ערכים
npm install
npm run dev
```

## לפני עלייה לאוויר
- להשלים את עמודי `/info/terms`, `/info/privacy`, `/info/accessibility` ומדיניות ההחלפות (`src/app/(shop)/info/[page]/page.tsx`).
- להחליף את תמונות המוצרים בתמונות נקיות מהספק (בחלק מהתמונות נשארו שאריות טקסט מהפוסטרים).
- לחבר דומיין ב־Vercel → Settings → Domains.
