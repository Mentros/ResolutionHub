import { Component, Input } from '@angular/core';
import { CrsdCard } from '@mentros/crsd-ui';
import { WikiEntry } from '../../core/models';
import { TagList } from '../../issues/tag-list/tag-list';

@Component({
  selector: 'app-wiki-entry-list',
  imports: [CrsdCard, TagList],
  templateUrl: './wiki-entry-list.html',
  styles: ':host { display: contents; }',
})
export class WikiEntryList {
  @Input({ required: true }) entries!: WikiEntry[];
}
