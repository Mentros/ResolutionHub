import { Component, Input, output } from '@angular/core';
import { CrsdBadge, type CrsdBadgeColor } from '@mentros/crsd-ui';

@Component({
  selector: 'app-removable-label-chips',
  imports: [CrsdBadge],
  templateUrl: './removable-label-chips.html',
  styles: ':host { display: block; }',
})
export class RemovableLabelChips {
  @Input({ required: true }) labels!: string[];
  @Input() color: CrsdBadgeColor = 'secondary';
  readonly removeLabel = output<string>();
}
