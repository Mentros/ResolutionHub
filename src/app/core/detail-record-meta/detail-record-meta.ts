import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CrsdBadge } from '@mentros/crsd-ui';
import { TagList } from '../../issues/tag-list/tag-list';

@Component({
  selector: 'app-detail-record-meta',
  imports: [DatePipe, CrsdBadge, TagList],
  templateUrl: './detail-record-meta.html',
  styles: ':host { display: block; }',
})
export class DetailRecordMeta {
  @Input() statLabel: string | null = null;
  @Input({ required: true }) updatedAt!: string;
  @Input() programs: string[] = [];
  @Input() topics: string[] = [];
  @Input() collapseAfter = 12;
}
