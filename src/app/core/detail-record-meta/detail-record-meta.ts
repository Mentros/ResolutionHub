import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, Input, computed } from '@angular/core';
import { CrsdBadge } from '@mentros/crsd-ui';
import { TAG_PROGRAMS_URL, TagProgramsResponse } from '../tags/tag-programs';
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
  @Input() tagFilterPath: string | null = null;

  private readonly programGroupsResource = httpResource<TagProgramsResponse>(
    () => ({ url: TAG_PROGRAMS_URL }),
    { defaultValue: { groups: [] } },
  );

  readonly programGroups = computed(() =>
    this.programGroupsResource.status() === 'error'
      ? []
      : this.programGroupsResource.value().groups,
  );
}
