export const LOCATION_SUGGESTIONS_URL = '/api/locations/suggestions';

export type LocationSuggestionKind = 'url' | 'share' | 'all';

export interface LocationSuggestion {
  value: string;
  hint: string | null;
}

export interface LocationSuggestionsResponse {
  suggestions: LocationSuggestion[];
}

export function locationSuggestionsUrl(kind: LocationSuggestionKind): string {
  return `${LOCATION_SUGGESTIONS_URL}?kind=${encodeURIComponent(kind)}&limit=200`;
}
