import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CrsdBadge } from '@mentros/crsd-ui';
import { TagList } from '../../issues/tag-list/tag-list';

@Component({
  selector: 'app-search-card-footer',
  imports: [DatePipe, CrsdBadge, TagList],
  templateUrl: './search-card-footer.html',
  styles: ':host { display: block; }',
})
export class SearchCardFooter {
  @Input({ required: true }) statLabel!: string;
  @Input({ required: true }) updatedAt!: string;
  @Input() programs: string[] = [];
  @Input() topics: string[] = [];
  @Input() collapseAfter = 6;
}
