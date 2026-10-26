import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class IssueSearch {
  readonly query = signal('');
  readonly programs = signal<string[]>([]);
}
