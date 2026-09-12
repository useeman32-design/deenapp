/* pass 83-39 — shared server-backed articles list.
 * The list screen and the reader MUST agree on indices, so both consume this
 * one store: server (admin-managed) articles when reachable, bundled deck as
 * fallback. */
import { useEffect, useState } from 'react';
import { ARTICLES, type Article } from '@/data/learn';
import { fetchArticles } from '@/api/client';

let cache: Article[] | null = null;
let inflight: Promise<Article[]> | null = null;

function load(): Promise<Article[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchArticles()
      .then((rows) => {
        const list: Article[] = rows && rows.length
          ? rows.map((a) => ({
              title: a.title,
              tag: a.tag,
              mins: a.mins,
              icon: a.icon,
              img: a.img_key ? ({ uri: `/img/articles/${a.img_key}` } as unknown as number) : undefined,
              body: (a.body || '').split('\n\n').filter(Boolean),
            }))
          : ARTICLES;
        cache = list;
        return list;
      })
      .catch(() => ARTICLES);
  }
  return inflight;
}

export function useArticlesList(): Article[] {
  const [list, setList] = useState<Article[]>(cache ?? ARTICLES);
  useEffect(() => {
    let alive = true;
    load().then((l) => { if (alive) setList(l); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return list;
}
