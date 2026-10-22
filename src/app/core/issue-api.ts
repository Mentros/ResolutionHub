import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
  HttpResourceRequest,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Issue, IssueInput, IssueSummary } from './models';

export const TAGS_URL = '/api/tags';
export const ISSUES_URL = '/api/issues';

export function issueListRequest(query: string, tags: string[]): HttpResourceRequest {
  let params = new HttpParams();
  const trimmed = query.trim();
  if (trimmed) {
    params = params.set('q', trimmed);
  }
  for (const tag of tags) {
    params = params.append('tags', tag);
  }
  return { url: ISSUES_URL, params };
}

@Injectable({ providedIn: 'root' })
export class TagApi {
  private readonly http = inject(HttpClient);

  createTag(name: string): Observable<{ name: string }> {
    return this.http.post<{ name: string }>(TAGS_URL, { name });
  }

  deleteTag(name: string): Observable<void> {
    return this.http.delete<void>(TAGS_URL, { body: { name } });
  }
}

@Injectable({ providedIn: 'root' })
export class IssueApi {
  private readonly http = inject(HttpClient);

  getIssue(id: number): Observable<Issue> {
    return this.http.get<Issue>(`${ISSUES_URL}/${id}`);
  }

  createIssue(input: IssueInput): Observable<Issue> {
    return this.http.post<Issue>(ISSUES_URL, input);
  }

  updateIssue(id: number, input: IssueInput): Observable<Issue> {
    return this.http.put<Issue>(`${ISSUES_URL}/${id}`, input);
  }

  deleteIssue(id: number): Observable<void> {
    return this.http.delete<void>(`${ISSUES_URL}/${id}`);
  }
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error;
    }
  }
  return fallback;
}
