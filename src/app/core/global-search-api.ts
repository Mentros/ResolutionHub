import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { GlobalSearchResult } from './models';

export const SEARCH_URL = '/api/search';

@Injectable({ providedIn: 'root' })
export class GlobalSearchApi {
  private readonly http = inject(HttpClient);

  search(query: string, limit = 8): Observable<GlobalSearchResult> {
    let params = new HttpParams().set('limit', String(limit));
    const trimmed = query.trim();
    if (trimmed) {
      params = params.set('q', trimmed);
    }
    return this.http.get<GlobalSearchResult>(SEARCH_URL, { params });
  }
}
