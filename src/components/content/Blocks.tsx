import Link from "next/link";
import type { PageBlock } from "@/lib/content-shared";
import { resolveHref } from "@/lib/content-shared";

/** Paragraph text: blank line = new paragraph, single newline = line break. */
function Para({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <p>
      {lines.map((l, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {l}
        </span>
      ))}
    </p>
  );
}

/** Renders CMS page blocks with the store's styles (used by /info/<slug>). */
export default function Blocks({ blocks, whatsapp }: { blocks: PageBlock[]; whatsapp?: string }) {
  return (
    <div className="flex flex-col gap-4 text-[16px] leading-8 text-[#45443F]">
      {blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return b.level === 3 ? (
              <h3 key={b.id} className="font-display font-bold text-[20px] md:text-[22px] text-ink pt-2">{b.text}</h3>
            ) : (
              <h2 key={b.id} className="font-display font-bold text-[24px] md:text-[28px] text-ink pt-4">{b.text}</h2>
            );
          case "paragraph":
            return b.text.split(/\n{2,}/).map((t, i) => <Para key={b.id + "-" + i} text={t} />);
          case "image":
            return (
              <figure key={b.id} className="flex flex-col gap-2 my-2">
                <img src={b.url} alt={b.alt} loading="lazy" className="w-full rounded-[18px] bg-panel" />
                {b.caption && <figcaption className="text-[14px] text-muted">{b.caption}</figcaption>}
              </figure>
            );
          case "button": {
            const href = resolveHref(b.href, whatsapp);
            const internal = /^\/(?!\/)/.test(href);
            return (
              <div key={b.id} className="pt-1">
                {internal ? (
                  <Link href={href} className="btn btn-dark">{b.text}</Link>
                ) : (
                  <a href={href} target="_blank" rel="noopener" className="btn btn-dark">{b.text}</a>
                )}
              </div>
            );
          }
          case "faq":
            return (
              <details key={b.id} className="group border-b border-line py-3">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-ink text-[17px] min-h-[44px]">
                  {b.q}
                  <span aria-hidden="true" className="text-golddark text-[22px] leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                {b.a && <div className="pt-2">{b.a.split(/\n{2,}/).map((t, i) => <Para key={i} text={t} />)}</div>}
              </details>
            );
          case "divider":
            return <hr key={b.id} className="border-line my-4" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
