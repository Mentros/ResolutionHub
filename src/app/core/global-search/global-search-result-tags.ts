import { Component, input } from '@angular/core';
import { TagList } from '../../issues/tag-list/tag-list';
import { TagProgramGroup } from '../tags/tag-programs';

@Component({
  selector: 'app-global-search-result-tags',
  imports: [TagList],
  templateUrl: './global-search-result-tags.html',
})
export class GlobalSearchResultTags {
  readonly tags = input.required<string[]>();
  readonly programGroups = input.required<TagProgramGroup[]>();
  readonly collapseAfter = input(3);
  readonly navigate = input.required<(tag: string) => void>();
}
