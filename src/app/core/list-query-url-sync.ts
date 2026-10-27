import { DestroyRef, WritableSignal, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  listQueryParamsForRouter,
  listQueryStateKey,
  parseListQueryParams,
} from './list-query-params';

export interface ListQueryUrlSyncOptions {
  query: WritableSignal<string>;
  tags: WritableSignal<string[]>;
  draft: WritableSignal<string>;
}

/** Keeps list search signals and route query params in sync (shareable filtered URLs). */
export function wireListQueryUrlSync(options: ListQueryUrlSyncOptions): { pushQueryParams: () => void } {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);

  let applyingFromUrl = false;

  const pushQueryParams = (): void => {
    if (applyingFromUrl) return;
    const state = { q: options.query(), tags: options.tags() };
    const urlKey = listQueryStateKey(parseListQueryParams(route.snapshot.queryParamMap));
    const nextKey = listQueryStateKey(state);
    if (nextKey === urlKey) return;
    void router.navigate([], {
      relativeTo: route,
      queryParams: listQueryParamsForRouter(state.q, state.tags),
      replaceUrl: true,
    });
  };

  const applyFromUrl = (): void => {
    const state = parseListQueryParams(route.snapshot.queryParamMap);
    const nextKey = listQueryStateKey(state);
    const currentKey = listQueryStateKey({ q: options.query(), tags: options.tags() });
    if (nextKey === currentKey) return;
    applyingFromUrl = true;
    options.query.set(state.q);
    options.draft.set(state.q);
    options.tags.set(state.tags);
    applyingFromUrl = false;
  };

  route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => applyFromUrl());

  effect(() => {
    options.query();
    options.tags();
    pushQueryParams();
  });

  return { pushQueryParams };
}
