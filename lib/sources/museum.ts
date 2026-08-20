import type { RawArticle, SourceDef } from "./types";

/**
 * "今日艺术" — daily featured artworks pulled from free, keyless museum
 * APIs (listed in public-apis/public-apis). These are static art objects,
 * not news, so they render in a dedicated gallery strip (subcategory
 * `art-gallery`) rather than the merged art-news stream.
 */

const ARTIC_ENDPOINT =
  "https://api.artic.edu/api/v1/artworks?limit=6&fields=id,title,artist_title,date_display,medium_display,artist_display,image_id,department_title,is_public_domain";

export async function fetchArtic(sourceId: string): Promise<RawArticle[]> {
  const res = await fetch(ARTIC_ENDPOINT);
  if (!res.ok) throw new Error(`Art Institute Chicago API ${res.status}`);
  const json = await res.json() as {
    data?: Array<{
      id: number;
      title?: string;
      artist_title?: string | null;
      artist_display?: string | null;
      date_display?: string | null;
      medium_display?: string | null;
      department_title?: string | null;
      image_id?: string | null;
      is_public_domain?: boolean | null;
    }>;
  };
  const now = new Date();
  const out: RawArticle[] = [];
  for (const a of json.data ?? []) {
    if (!a.image_id || !a.title) continue;
    out.push({
      sourceId,
      title: a.title,
      url: `https://www.artic.edu/artworks/${a.id}`,
      image: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`,
      meta: [a.artist_title, a.date_display, a.department_title]
        .filter((x): x is string => Boolean(x))
        .join(" · "),
      excerpt: a.medium_display ?? undefined,
      category: "tech",
      publishedAt: now,
    });
  }
  return out;
}

const MET_SEARCH =
  "https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&medium=Paintings&q=painting";

export async function fetchMet(sourceId: string): Promise<RawArticle[]> {
  const search = await fetch(MET_SEARCH);
  if (!search.ok) throw new Error(`Met search API ${search.status}`);
  const s = await search.json() as { objectIDs?: number[] };
  const ids = (s.objectIDs ?? []).slice(0, 4);
  const now = new Date();
  const out: RawArticle[] = [];
  for (const id of ids) {
    const res = await fetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
    );
    if (!res.ok) continue;
    const o = await res.json() as {
      title?: string;
      artistDisplayName?: string;
      objectDate?: string;
      medium?: string;
      department?: string;
      primaryImageSmall?: string;
      objectURL?: string;
      imageUrl?: string;
    };
    const img = o.primaryImageSmall ?? o.imageUrl;
    if (!o.title || !img) continue;
    out.push({
      sourceId,
      title: o.title,
      url: o.objectURL ?? `https://www.metmuseum.org/art/collection/search/${id}`,
      image: img,
      meta: [o.artistDisplayName, o.objectDate, o.department]
        .filter((x): x is string => Boolean(x))
        .join(" · "),
      excerpt: o.medium ?? undefined,
      category: "tech",
      publishedAt: now,
    });
  }
  return out;
}

const HANDLERS: Record<string, (sourceId: string) => Promise<RawArticle[]>> = {
  "artic-museum": fetchArtic,
  "met-museum": fetchMet,
};

export function fetchMuseum(source: SourceDef): Promise<RawArticle[]> {
  return HANDLERS[source.id](source.id);
}