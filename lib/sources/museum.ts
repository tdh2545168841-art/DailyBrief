import type { RawArticle, SourceDef } from "./types";

/**
 * "今日馆藏" — daily featured artworks pulled from free, keyless museum
 * APIs (listed in public-apis/public-apis). These are static art objects,
 * not news, so they render in a dedicated gallery strip (subcategory
 * `art-gallery`) rather than the merged art-news stream.
 */

const ARTIC_ENDPOINT =
  "https://api.artic.edu/api/v1/artworks?limit=6&fields=id,title,artist_title,date_display,medium_display,artist_display,image_id,department_title,is_public_domain";

export async function fetchArtic(sourceId: string): Promise<RawArticle[]> {
  // ArtIC/Met 等 keyless 艺术 API 在 CI 上会接受 TCP 连接但永不返回，
  // 因此每个 fetch 都带 15s 超时，并在出错时静默降级为空列表，
  // 避免单个不稳定的免费艺术 API 阻塞整个日报流程。
  try {
    const res = await fetch(ARTIC_ENDPOINT, {
      signal: AbortSignal.timeout(15_000),
    });
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
  } catch {
    // 超时或网络异常时静默降级为空列表
    return [];
  }
}

const MET_SEARCH =
  "https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&medium=Paintings&q=painting";

export async function fetchMet(sourceId: string): Promise<RawArticle[]> {
  try {
    const search = await fetch(MET_SEARCH, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!search.ok) throw new Error(`Met search API ${search.status}`);
    const s = await search.json() as { objectIDs?: number[] };
    const ids = (s.objectIDs ?? []).slice(0, 4);
    const now = new Date();

    // 用 Promise.allSettled 并发获取对象详情：单个对象请求卡住不会阻塞其他对象，
    // 每个 fetch 仍带独立 15s 超时；仅收集 fulfilled 的结果。
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(
          `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
          { signal: AbortSignal.timeout(15_000) },
        ).then(async (res) => {
          if (!res.ok) throw new Error(`Met object ${id} HTTP ${res.status}`);
          return (await res.json()) as {
            title?: string;
            artistDisplayName?: string;
            objectDate?: string;
            medium?: string;
            department?: string;
            primaryImageSmall?: string;
            objectURL?: string;
            imageUrl?: string;
          };
        }),
      ),
    );

    const out: RawArticle[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== "fulfilled") continue;
      const o = r.value;
      const id = ids[i];
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
  } catch {
    // 超时或网络异常时静默降级为空列表
    return [];
  }
}

const HANDLERS: Record<string, (sourceId: string) => Promise<RawArticle[]>> = {
  "artic-museum": fetchArtic,
  "met-museum": fetchMet,
};

export function fetchMuseum(source: SourceDef): Promise<RawArticle[]> {
  return HANDLERS[source.id](source.id);
}
