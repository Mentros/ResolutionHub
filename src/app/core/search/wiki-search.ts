import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WikiSearch {
  readonly query = signal('');
  readonly tags = signal<string[]>([]);
}
