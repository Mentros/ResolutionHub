import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiErrorMessage } from './issue-api';

export { apiErrorMessage, HttpErrorResponse };

export const PROGRAMS_URL = '/api/programs';
export const WIKI_TOPICS_URL = '/api/wiki-topics';

@Injectable({ providedIn: 'root' })
export class ProgramApi {
  private readonly http = inject(HttpClient);

  create(name: string): Observable<{ name: string }> {
    return this.http.post<{ name: string }>(PROGRAMS_URL, { name });
  }

  delete(name: string): Observable<void> {
    return this.http.delete<void>(PROGRAMS_URL, { body: { name } });
  }
}

@Injectable({ providedIn: 'root' })
export class WikiTopicApi {
  private readonly http = inject(HttpClient);

  create(name: string): Observable<{ name: string }> {
    return this.http.post<{ name: string }>(WIKI_TOPICS_URL, { name });
  }

  delete(name: string): Observable<void> {
    return this.http.delete<void>(WIKI_TOPICS_URL, { body: { name } });
  }
}
