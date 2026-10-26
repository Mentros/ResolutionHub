import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CrsdBadge } from '@mentros/crsd-ui';
import { TagList } from '../../issues/tag-list/tag-list';

@Component({
  selector: 'app-detail-record-meta',
  imports: [DatePipe, CrsdBadge, TagList],
  templateUrl: './detail-record-meta.html',
})
export class DetailRecordMeta {
  @Input({ required: true }) statLabel!: string;
  @Input({ required: true }) updatedAt!: string;
  @Input() tags: string[] = [];
  @Input() collapseAfter = 6;
}
