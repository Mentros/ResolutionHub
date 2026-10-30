import type { ParamMap } from '@angular/router';
import { describe, expect, it } from 'vitest';
import {
  listQueryParamsForRouter,
  listQueryStateKey,
  parseListQueryParams,
  queryParamsForTagFilter,
} from './list-query-params';

function paramMap(params: Record<string, string | string[]>): ParamMap {
  return {
    has: (name) => name in params,
    get: (name) => {
      const value = params[name];
      if (value === undefined) return null;
      return Array.isArray(value) ? (value[0] ?? null) : value;
    },
    getAll: (name) => {
      const value = params[name];
      if (value === undefined) return [];
      return Array.isArray(value) ? value : [value];
    },
    keys: [],
  };
}

describe('parseListQueryParams', () => {
  it('reads q and repeated tags', () => {
    expect(parseListQueryParams(paramMap({ q: 'skype', tags: ['Teams', 'Skype'] }))).toEqual({
      q: 'skype',
      tags: ['Teams', 'Skype'],
    });
  });

  it('splits comma-separated tags and dedupes case-insensitively', () => {
    expect(parseListQueryParams(paramMap({ tags: ['A,b', 'a'] }))).toEqual({
      q: '',
      tags: ['A', 'b'],
    });
  });

  it('trims q', () => {
    expect(parseListQueryParams(paramMap({ q: '  x  ' }))).toEqual({ q: 'x', tags: [] });
  });
});

describe('listQueryParamsForRouter', () => {
  it('omits empty q and tags', () => {
    expect(listQueryParamsForRouter('', [])).toEqual({ q: null, tags: null });
  });

  it('keeps non-empty values', () => {
    expect(listQueryParamsForRouter('a', ['T1'])).toEqual({ q: 'a', tags: ['T1'] });
  });
});

describe('queryParamsForTagFilter', () => {
  it('sets only tags', () => {
    expect(queryParamsForTagFilter('Teams')).toEqual({ q: null, tags: ['Teams'] });
  });
});

describe('listQueryStateKey', () => {
  it('ignores tag order', () => {
    const a = listQueryStateKey({ q: 'x', tags: ['B', 'a'] });
    const b = listQueryStateKey({ q: 'x', tags: ['a', 'B'] });
    expect(a).toBe(b);
  });
});
