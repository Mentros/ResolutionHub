import {
  HttpClient,
  HttpParams,
  HttpResourceRequest,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { WikiSite, WikiSiteInput, WikiSiteSummary } from './models';

export const WIKI_SITES_URL = '/api/wiki-sites';

export function wikiSiteListRequest(
  query: string,
  programs: string[],
  topics: string[],
): HttpResourceRequest {
  let params = new HttpParams();
  const trimmed = query.trim();
  if (trimmed) {
    params = params.set('q', trimmed);
  }
  for (const program of programs) {
    params = params.append('programs', program);
  }
  for (const topic of topics) {
    params = params.append('topics', topic);
  }
  return { url: WIKI_SITES_URL, params };
}

@Injectable({ providedIn: 'root' })
export class WikiSiteApi {
  private readonly http = inject(HttpClient);

  getWikiSite(id: number): Observable<WikiSite> {
    return this.http.get<WikiSite>(`${WIKI_SITES_URL}/${id}`);
  }

  createWikiSite(input: WikiSiteInput): Observable<WikiSite> {
    return this.http.post<WikiSite>(WIKI_SITES_URL, input);
  }

  updateWikiSite(id: number, input: WikiSiteInput): Observable<WikiSite> {
    return this.http.put<WikiSite>(`${WIKI_SITES_URL}/${id}`, input);
  }

  deleteWikiSite(id: number): Observable<void> {
    return this.http.delete<void>(`${WIKI_SITES_URL}/${id}`);
  }
}
