import { isAdmin, currentAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db, hasDb } from "@/lib/db";
import { getAttributes } from "@/lib/catalog";
import { Notice, PageHeader } from "../_components/ui";
import AttributesEditor from "./AttributesEditor";

export const dynamic = "force-dynamic";

/* EU women's shoe sizes → US / UK (common retail conversion; brands vary by up to half a size). */
const CONVERSION: { eu: string; us: string; uk: string; cm: string }[] = [
  { eu: "35", us: "5", uk: "2.5", cm: "22.5" },
  { eu: "36", us: "6", uk: "3.5", cm: "23" },
  { eu: "37", us: "6.5", uk: "4", cm: "23.5" },
  { eu: "38", us: "7.5", uk: "5", cm: "24" },
  { eu: "39", us: "8.5", uk: "6", cm: "25" },
  { eu: "40", us: "9", uk: "6.5", cm: "25.5" },
  { eu: "41", us: "9.5", uk: "7", cm: "26" },
  { eu: "42", us: "10", uk: "8", cm: "26.5" },
  { eu: "43", us: "11", uk: "9", cm: "27.5" },
];

export default async function AttributesAdmin() {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  const canEdit = hasDb() && !!me && can(me.perms, "attributes", "edit");
  const attrs = await getAttributes();

  const sizeUse: Record<string, number> = {};
  const colorUse: Record<string, number> = {};
  let usageError = false;
  if (hasDb()) {
    try {
      const sql = await db();
      const [s, c] = await Promise.all([
        sql`select s.key as size, count(*)::int as n from products p, jsonb_each_text(case when jsonb_typeof(p.stock) = 'object' then p.stock else '{}'::jsonb end) s where (s.value)::numeric > 0 group by s.key`,
        sql`select c as color, count(distinct id)::int as n from (
      select id, color as c from products
      union all
      select p.id, v->>'key' from products p, jsonb_array_elements(coalesce(p.variants->'colors', '[]'::jsonb)) v
    ) x group by c`,
      ]);
      for (const r of s) sizeUse[String(r.size)] = Number(r.n);
      for (const r of c) colorUse[String(r.color)] = Number(r.n);
    } catch (e) {
      console.error(e);
      usageError = true;
    }
  }
  const unknownSizes = Object.keys(sizeUse).filter((s) => !attrs.sizes.includes(s));
  const unknownColors = Object.keys(colorUse).filter((k) => !attrs.colors.some((c) => c.key === k));

  return (
    <>
      <PageHeader title="מידות וצבעים" sub="המאפיינים שמופיעים במסנני החנות, בכפתורי המידה בדף המוצר ובעורך המוצרים." />
      {usageError && <Notice tone="amber">לא הצלחנו לחשב כמה מוצרים משתמשים בכל מידה וצבע. השמירה עדיין בודקת זאת בצד השרת.</Notice>}
      {(unknownSizes.length > 0 || unknownColors.length > 0) && (
        <Notice tone="blue">
          יש מוצרים עם {unknownSizes.length > 0 && <>מידות שלא ברשימה (<span dir="ltr">{unknownSizes.join(", ")}</span>)</>}
          {unknownSizes.length > 0 && unknownColors.length > 0 && " ו"}
          {unknownColors.length > 0 && <>צבעים שלא ברשימה (<span dir="ltr">{unknownColors.join(", ")}</span>)</>}. כדאי להוסיף אותם כדי שיופיעו במסננים ובעורך.
        </Notice>
      )}
      <div className="grid xl:grid-cols-[1fr_1fr_340px] gap-5 items-start">
        <AttributesEditor sizes={attrs.sizes} colors={attrs.colors} sizeUse={sizeUse} colorUse={colorUse} canEdit={canEdit} />
        <section className="a-card flex flex-col gap-3" aria-labelledby="conv-title">
          <div>
            <h2 id="conv-title" className="text-[16px] font-bold text-adm-navy">טבלת המרת מידות (נשים)</h2>
            <p className="text-[13px] text-adm-muted leading-5">לעיון בלבד – לשימוש במענה ללקוחות. ההמרה משתנה מעט בין מותגים.</p>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
          <table className="a-table text-center">
            <thead>
              <tr><th className="!text-center">EU</th><th className="!text-center">US</th><th className="!text-center">UK</th><th className="!text-center">אורך כף רגל (ס״מ)</th></tr>
            </thead>
            <tbody>
              {CONVERSION.map((r) => (
                <tr key={r.eu} className={attrs.sizes.includes(r.eu) ? "" : "text-adm-muted"}>
                  <td className="font-bold">{r.eu}</td><td>{r.us}</td><td>{r.uk}</td><td>{r.cm}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      </div>
    </>
  );
}
