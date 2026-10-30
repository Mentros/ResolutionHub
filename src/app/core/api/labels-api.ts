import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiErrorMessage } from './issue-api';

export { apiErrorMessage, HttpErrorResponse };

export const TAGS_URL = '/api/tags';

export const TAG_ENTRIES_URL = '/api/tags/entries';

export interface TagListEntry {
  name: string;
  parent: string | null;
}

/** @deprecated Use TAGS_URL */
export const PROGRAMS_URL = TAGS_URL;

/** @deprecated Wiki topics merged into tags */
export const WIKI_TOPICS_URL = TAGS_URL;

@Injectable({ providedIn: 'root' })
export class TagApi {
  private readonly http = inject(HttpClient);

  create(name: string, parent?: string | null): Observable<{ name: string; parent: string | null }> {
    const body: { name: string; parent?: string } = { name };
    if (parent) {
      body.parent = parent;
    }
    return this.http.post<{ name: string; parent: string | null }>(TAGS_URL, body);
  }

  delete(name: string): Observable<void> {
    return this.http.delete<void>(TAGS_URL, { body: { name } });
  }
}

/** @deprecated Use TagApi */
export const ProgramApi = TagApi;

/** @deprecated Use TagApi */
export const WikiTopicApi = TagApi;
