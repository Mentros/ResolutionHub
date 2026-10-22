import { Component, Input } from '@angular/core';
import { CrsdBadge } from '@mentros/crsd-ui';

@Component({
  selector: 'app-tag-list',
  imports: [CrsdBadge],
  templateUrl: './tag-list.html',
  styles: ':host { display: contents; }',
})
export class TagList {
  @Input({ required: true }) tags!: string[];
}
