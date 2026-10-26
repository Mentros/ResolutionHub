import { Component, Input, computed, signal } from '@angular/core';
import { CrsdBadge, CrsdBtn, type CrsdBadgeColor } from '@mentros/crsd-ui';

@Component({
  selector: 'app-tag-list',
  imports: [CrsdBadge, CrsdBtn],
  templateUrl: './tag-list.html',
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    :host(.search-card-chips) {
      display: contents;
    }
    :host(.search-card-chips) .tag-list-root {
      display: contents;
    }
  `,
})
export class TagList {
  @Input({ required: true }) tags!: string[];
  /** Short heading shown above the chips (e.g. Programs, Wiki topics). */
  @Input() caption: string | null = null;
  @Input() kind: 'default' | 'program' | 'topic' = 'default';
  /** When set, collapse long lists until the user expands them. */
  @Input() collapseAfter = 0;

  readonly expanded = signal(false);

  readonly badgeColor = computed((): CrsdBadgeColor => {
    if (this.kind === 'topic') return 'info';
    return 'secondary';
  });

  readonly visibleTags = computed(() => {
    const limit = this.collapseAfter;
    if (limit <= 0 || this.expanded() || this.tags.length <= limit) {
      return this.tags;
    }
    return this.tags.slice(0, limit);
  });

  readonly hiddenCount = computed(() => {
    const limit = this.collapseAfter;
    if (limit <= 0 || this.expanded() || this.tags.length <= limit) return 0;
    return this.tags.length - limit;
  });

  readonly showToggle = computed(
    () => this.collapseAfter > 0 && this.tags.length > this.collapseAfter,
  );
}
