import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiErrorMessage } from './issue-api';

export { apiErrorMessage, HttpErrorResponse };

export const TAGS_URL = '/api/tags';

/** @deprecated Use TAGS_URL */
export const PROGRAMS_URL = TAGS_URL;

/** @deprecated Wiki topics merged into tags */
export const WIKI_TOPICS_URL = TAGS_URL;

@Injectable({ providedIn: 'root' })
export class TagApi {
  private readonly http = inject(HttpClient);

  create(name: string): Observable<{ name: string }> {
    return this.http.post<{ name: string }>(TAGS_URL, { name });
  }

  delete(name: string): Observable<void> {
    return this.http.delete<void>(TAGS_URL, { body: { name } });
  }
}

/** @deprecated Use TagApi */
export const ProgramApi = TagApi;

/** @deprecated Use TagApi */
export const WikiTopicApi = TagApi;
