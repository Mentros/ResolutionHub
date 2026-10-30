import { Component, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrsdBadge, CrsdBtn, type CrsdBadgeColor } from '@mentros/crsd-ui';
import { queryParamsForTagFilter } from '../../core/list/list-query-params';
import { TagProgramGroup, parentForProgram, tagsForDisplayChips } from '../../core/tags/tag-programs';

@Component({
  selector: 'app-tag-list',
  imports: [RouterLink, CrsdBadge, CrsdBtn],
  templateUrl: './tag-list.html',
  styles: `
    :host {
      display: block;
      min-width: 0;
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

  /** When set, chips link to this list route with a tag filter (e.g. `/` or `/wikis`). */
  @Input() tagFilterPath: string | null = null;

  /** Used to add parent language tags when filtering by a program chip. */
  @Input() programGroups: TagProgramGroup[] = [];

  readonly expanded = signal(false);

  tagQueryParams(tag: string): Record<string, string | string[] | null> {
    const parent = parentForProgram(this.programGroups, tag);
    return queryParamsForTagFilter(tag, parent ? [parent] : []);
  }

  badgeColor(): CrsdBadgeColor {
    if (this.kind === 'topic') return 'info';
    return 'secondary';
  }

  displayTags(): string[] {
    return tagsForDisplayChips(this.tags, this.programGroups);
  }

  visibleTags(): string[] {
    const tags = this.displayTags();
    const limit = this.collapseAfter;
    if (limit <= 0 || this.expanded() || tags.length <= limit) {
      return tags;
    }
    return tags.slice(0, limit);
  }

  hiddenCount(): number {
    const tags = this.displayTags();
    const limit = this.collapseAfter;
    if (limit <= 0 || this.expanded() || tags.length <= limit) return 0;
    return tags.length - limit;
  }

  showToggle(): boolean {
    return this.collapseAfter > 0 && this.displayTags().length > this.collapseAfter;
  }
}
