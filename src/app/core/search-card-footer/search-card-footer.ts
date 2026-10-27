import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CrsdBadge } from '@mentros/crsd-ui';
import { TagList } from '../../issues/tag-list/tag-list';

@Component({
  selector: 'app-search-card-footer',
  imports: [DatePipe, CrsdBadge, TagList],
  templateUrl: './search-card-footer.html',
})
export class SearchCardFooter {
  @Input({ required: true }) statLabel!: string;
  @Input({ required: true }) updatedAt!: string;
  @Input() tags: string[] = [];
  @Input() collapseAfter = 4;
  /** List route for clickable tag filters (`/` or `/wikis`). */
  @Input() tagFilterPath: string | null = null;
}
