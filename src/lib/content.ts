import { cache } from "react";
import { db, hasDb } from "./db";
import { getSetting, getStoreInfo, setSetting } from "./site";
import { CATEGORIES, STORE } from "./config";
import {
  defaultMenus,
  defaultPages,
  defaultSections,
  israelToday,
  normalizeMenus,
  normalizeSections,
  normPage,
  pageIsLive,
  sectionLive,
  SLUG_RE,
  type CmsPage,
  type HomepageSetting,
  type HomeSection,
  type Menus,
} from "./content-shared";

export * from "./content-shared";

/* Site content managed from the admin: home page sections, info/blog pages and menus.
   SERVER ONLY (reads the DB). Client components import from ./content-shared instead.
   Every storefront getter falls back to today's hard-coded content, so the live site looks
   exactly the same when nothing was saved, when the DB is missing, or when a read fails. */

/** Categories from the `categories` table when it has rows, otherwise the built-in list. */
export async function listCategoryOptions(): Promise<{ key: string; name: string }[]> {
  const fallback = Object.entries(CATEGORIES).map(([key, name]) => ({ key, name }));
  if (!hasDb()) return fallback;
  try {
    const sql = await db();
    const r = await sql`select key, name from categories where active = true order by sort asc, name asc`;
    return r.length ? r.map((x: any) => ({ key: String(x.key), name: String(x.name) })) : fallback;
  } catch (e) {
    console.error("categories read failed", e);
    return fallback;
  }
}

async function readHomepageSetting(): Promise<HomepageSetting | null> {
  try {
    const v = await getSetting<HomepageSetting | null>("homepage", null);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/** Storefront: the published sections that are live today. Defaults when nothing was published. */
export const getHomepage = cache(async (): Promise<HomeSection[]> => {
  try {
    const v = await readHomepageSetting();
    const sections = v && Array.isArray(v.sections) ? normalizeSections(v.sections) : defaultSections();
    const today = israelToday();
    return sections.filter((s) => sectionLive(s, today));
  } catch (e) {
    console.error("homepage read failed", e);
    return defaultSections();
  }
});

/** Admin: published + draft state. */
export async function getHomepageAdmin(): Promise<{ published: HomeSection[]; draft: HomeSection[]; hasDraft: boolean; publishedAt: string | null; isDefault: boolean }> {
  const v = await readHomepageSetting();
  const isDefault = !(v && Array.isArray(v.sections));
  const published = isDefault ? defaultSections() : normalizeSections(v!.sections);
  const draftRaw = v && Array.isArray(v.draft) ? normalizeSections(v.draft) : null;
  const hasDraft = !!draftRaw && JSON.stringify(draftRaw) !== JSON.stringify(published);
  return { published, draft: draftRaw || published, hasDraft, publishedAt: v?.publishedAt || null, isDefault };
}

/** Raw setting for writes (server actions). */
export async function readHomepageRaw(): Promise<HomepageSetting> {
  return (await readHomepageSetting()) || {};
}

export async function writeHomepage(v: HomepageSetting) {
  await setSetting("homepage", v);
}

/** Storefront + admin: saved menus or today's defaults. */
export const getMenus = cache(async (): Promise<Menus> => {
  try {
    const v = await getSetting<unknown>("menus", null);
    return v ? normalizeMenus(v) : defaultMenus();
  } catch (e) {
    console.error("menus read failed", e);
    return defaultMenus();
  }
});

export async function menusSaved(): Promise<boolean> {
  try {
    return !!(await getSetting<unknown>("menus", null));
  } catch {
    return false;
  }
}

/** Insert the built-in info pages once (tracked with the `pages_seeded` setting so deleted pages stay deleted). */
export async function ensurePagesSeeded(): Promise<boolean> {
  if (!hasDb()) return false;
  try {
    const sql = await db();
    // read the flag directly (not through the cached settings reader, which hides errors as "empty")
    const flag = await sql`select value from settings where key = 'pages_seeded' limit 1`;
    if (flag[0]) return false;
    const store = await getStoreInfo();
    const pages = defaultPages(store);
    let inserted = 0;
    for (const [slug, p] of Object.entries(pages)) {
      const blocks = p.body.map((text, i) => ({ id: `${slug}-${i + 1}`, type: "paragraph", text }));
      const r = await sql`
        insert into pages (slug, title, type, blocks, status, publish_at)
        values (${slug}, ${p.title}, 'page', ${JSON.stringify(blocks)}::jsonb, 'published', now())
        on conflict (slug) do nothing returning id`;
      inserted += r.length;
    }
    await setSetting("pages_seeded", true);
    return inserted > 0;
  } catch (e) {
    console.error("pages seed failed", e);
    return false;
  }
}

export async function listPages(): Promise<CmsPage[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`select * from pages order by updated_at desc, id desc`;
  return r.map(normPage);
}

export async function getPageById(id: number): Promise<CmsPage | null> {
  if (!hasDb() || !Number.isInteger(id) || id <= 0) return null;
  const sql = await db();
  const r = await sql`select * from pages where id = ${id} limit 1`;
  return r[0] ? normPage(r[0]) : null;
}

/** Live pages for link pickers (menus). Falls back to the built-in info pages. */
export async function listLinkablePages(): Promise<{ slug: string; title: string; type: string }[]> {
  const fallback = Object.entries(defaultPages()).map(([slug, p]) => ({ slug, title: p.title, type: "page" }));
  if (!hasDb()) return fallback;
  try {
    const all = await listPages();
    const live = all.filter((p) => pageIsLive(p));
    if (!all.length) return fallback;
    return live.map((p) => ({ slug: p.slug, title: p.title, type: p.type }));
  } catch {
    return fallback;
  }
}

/**
 * Storefront: the page for /info/<slug>.
 * - A DB row decides when it exists (unpublished → null, i.e. 404).
 * - No row (before the built-in pages were seeded) / no DB / DB error → the built-in page.
 */
export async function getPublicPage(slug: string): Promise<CmsPage | null> {
  if (!SLUG_RE.test(slug)) return null;
  const fallback = async (): Promise<CmsPage | null> => {
    let store: { city: string; address: string; phoneDisplay: string } = STORE;
    try {
      store = await getStoreInfo();
    } catch {}
    const p = defaultPages(store)[slug];
    if (!p) return null;
    return {
      id: 0,
      slug,
      title: p.title,
      type: "page",
      blocks: p.body.map((text, i) => ({ id: String(i), type: "paragraph", text })),
      status: "published",
      publish_at: null,
      seo_title: "",
      seo_description: "",
      share_image: "",
      created_at: "",
      updated_at: "",
    };
  };
  if (!hasDb()) return fallback();
  try {
    const sql = await db();
    const r = await sql`select * from pages where slug = ${slug} limit 1`;
    if (!r[0]) {
      // Once the built-in pages were copied to the DB, a missing row means it was deleted on purpose.
      const seeded = await getSetting<boolean>("pages_seeded", false);
      return seeded ? null : fallback();
    }
    const p = normPage(r[0]);
    return pageIsLive(p) ? p : null;
  } catch (e) {
    console.error("page read failed", e);
    return fallback();
  }
}
