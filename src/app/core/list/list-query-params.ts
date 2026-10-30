import { ParamMap } from '@angular/router';

export interface ListQueryState {
  q: string;
  tags: string[];
}

/** Read list search state from `?q=` and repeated or comma-separated `tags=`. */
export function parseListQueryParams(paramMap: ParamMap): ListQueryState {
  const q = paramMap.get('q')?.trim() ?? '';
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of paramMap.getAll('tags')) {
    for (const part of raw.split(',')) {
      const name = part.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(name);
    }
  }
  return { q, tags };
}

/** Router query params; `null` removes keys from the URL. */
export function listQueryParamsForRouter(
  q: string,
  tags: string[],
): Record<string, string | string[] | null> {
  const trimmed = q.trim();
  return {
    q: trimmed || null,
    tags: tags.length > 0 ? tags : null,
  };
}

/** Stable string for comparing URL state with in-memory search state. */
/** Query params for a single-tag list filter (shareable). */
export function queryParamsForTagFilter(
  tag: string,
  extraTags: string[] = [],
): Record<string, string | string[] | null> {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const name of [...extraTags, tag]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(name);
  }
  return listQueryParamsForRouter('', tags);
}

export function listQueryStateKey(state: ListQueryState): string {
  const tagPart = [...state.tags]
    .map((t) => t.toLowerCase())
    .sort()
    .join('\0');
  return `${state.q.trim()}\n${tagPart}`;
}
