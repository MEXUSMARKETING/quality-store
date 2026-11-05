import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE } from "@/lib/config";

const PAGES: Record<string, { title: string; body: string[] }> = {
  shipping: {
    title: "משלוחים והחזרות",
    body: [
      "משלוח עד הבית ללא עלות. השליח יתאם איתך את מועד המסירה מראש.",
      `אפשר גם לאסוף את ההזמנה מהחנות ב${STORE.city}, ${STORE.address}.`,
      "התשלום מתבצע במזומן בעת המסירה, או באשראי / Bit לפי בחירתך.",
      "[מדיניות החלפות והחזרות — יש להשלים לפי מדיניות החנות]",
    ],
  },
  sizes: {
    title: "מדריך מידות",
    body: [
      "המגפונים שלנו תואמים למידה הרגילה שלך (מידות אירופאיות EU).",
      "אם את בין שתי מידות — מומלץ לבחור את המידה הגדולה.",
      `לא בטוחה? כתבי לנו בוואטסאפ ${STORE.phoneDisplay} ונשמח לעזור.`,
    ],
  },
  terms: {
    title: "תקנון האתר",
    body: ["[תקנון האתר — יש להשלים לפני העלייה לאוויר: פרטי העסק, תנאי רכישה, ביטולים לפי חוק הגנת הצרכן, אחריות ומשלוחים]"],
  },
  privacy: {
    title: "מדיניות פרטיות",
    body: ["[מדיניות פרטיות — יש להשלים: איזה מידע נאסף (שם, טלפון, כתובת, מייל), לשם מה, ואיך אפשר לבקש מחיקה]"],
  },
  accessibility: {
    title: "הצהרת נגישות",
    body: ["[הצהרת נגישות — יש להשלים לפי תקנות שוויון זכויות לאנשים עם מוגבלות, כולל פרטי רכז/ת נגישות]"],
  },
};

export function generateMetadata({ params }: { params: { page: string } }) {
  return { title: PAGES[params.page]?.title || "מידע" };
}

export default function InfoPage({ params }: { params: { page: string } }) {
  const page = PAGES[params.page];
  if (!page) notFound();
  return (
    <div className="container-site py-12 md:py-16 max-w-[760px]">
      <nav className="text-sm text-muted pb-4"><Link href="/">בית</Link> / {page.title}</nav>
      <h1 className="font-display font-extrabold text-[32px] md:text-[44px] pb-6">{page.title}</h1>
      <div className="flex flex-col gap-4 text-[16px] leading-8 text-[#45443F]">
        {page.body.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </div>
  );
}
