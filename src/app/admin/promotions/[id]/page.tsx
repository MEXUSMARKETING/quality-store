import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { promoState } from "@/lib/promotions-shared";
import { Chip, Icon, Notice, PageHeader } from "../../_components/ui";
import { toIsraelYmd } from "../../coupons/lib";
import PromoEditor from "../PromoEditor";
import { editorData } from "../data";

export const dynamic = "force-dynamic";
export const metadata = { title: "עריכת מבצע" };

const STATE = { active: { label: "פעיל עכשיו", tone: "green" }, scheduled: { label: "מתוזמן", tone: "blue" }, expired: { label: "הסתיים", tone: "gray" }, disabled: { label: "מושהה", tone: "amber" } } as const;

export default async function EditPromotionPage({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string } }) {
  if (!isAdmin()) return null;
  const id = Number(params.id);
  const { categories, products, others, promos } = await editorData();
  const p = promos.find((x) => x.id === id);
  if (!p) notFound();
  const st = promoState(p);
  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { href: "/admin/promotions", label: "מבצעים" }, { label: p.name }]} title={p.name} sub={<Chip tone={STATE[st].tone}>{STATE[st].label}</Chip>}>
        <Link href="/admin/promotions" className="a-btn"><Icon name="arrowRight" /> לכל המבצעים</Link>
      </PageHeader>
      {searchParams.saved && <Notice tone="green">המבצע נשמר.{st === "active" ? " הוא כבר פועל באתר." : st === "scheduled" ? " הוא יתחיל בתאריך שנקבע." : ""}</Notice>}
      <PromoEditor
        key={p.updated_at}
        initial={{ id: p.id, name: p.name, type: p.type, badge: p.badge, scope: p.scope, config: p.config, starts_at: toIsraelYmd(p.starts_at), ends_at: toIsraelYmd(p.ends_at), active: p.active, allow_coupon: p.allow_coupon }}
        categories={categories}
        products={products}
        others={others}
      />
    </>
  );
}
