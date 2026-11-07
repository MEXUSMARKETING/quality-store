import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicPage } from "@/lib/content";
import { getStoreInfo } from "@/lib/site";
import Blocks from "@/components/content/Blocks";

/* Info pages and blog posts (/info/<slug>).
   Content comes from the admin (table `pages`); the original built-in pages
   (shipping, sizes, terms, privacy, accessibility) are the fallback when the DB is empty or down. */

export const dynamic = "force-dynamic";

const firstText = (blocks: { type: string; text?: string; a?: string }[]) => {
  for (const b of blocks) if (b.type === "paragraph" && b.text) return b.text.replace(/\s+/g, " ").slice(0, 160);
  return "";
};

export async function generateMetadata({ params }: { params: { page: string } }) {
  const page = await getPublicPage(params.page);
  if (!page) return { title: "מידע" };
  const title = page.seo_title || page.title;
  const description = page.seo_description || firstText(page.blocks) || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/info/${page.slug}` },
    openGraph: { title, description, type: page.type === "blog" ? "article" : "website", images: page.share_image ? [page.share_image] : undefined },
  };
}

export default async function InfoPage({ params }: { params: { page: string } }) {
  const page = await getPublicPage(params.page);
  if (!page) notFound();
  let whatsapp: string | undefined;
  try {
    whatsapp = (await getStoreInfo()).whatsapp;
  } catch {}
  const faqs = page.blocks.filter((b) => b.type === "faq") as { q: string; a: string }[];
  const date = page.type === "blog" && page.publish_at ? new Date(page.publish_at).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="container-site py-12 md:py-16 max-w-[760px]">
      <nav className="text-sm text-muted pb-4"><Link href="/">בית</Link> / {page.title}</nav>
      <h1 className="font-display font-extrabold text-[32px] md:text-[44px] pb-6">{page.title}</h1>
      {date && <p className="text-sm text-muted -mt-4 pb-6">{date}</p>}
      <Blocks blocks={page.blocks} whatsapp={whatsapp} />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
    </div>
  );
}
