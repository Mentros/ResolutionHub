import { Component, Input, output } from '@angular/core';
import { CrsdRemovableBadge, type CrsdBadgeColor } from '@mentros/crsd-ui';

@Component({
  selector: 'app-removable-label-chips',
  imports: [CrsdRemovableBadge],
  templateUrl: './removable-label-chips.html',
  styles: ':host { display: block; }',
})
export class RemovableLabelChips {
  @Input({ required: true }) labels!: string[];
  @Input() color: CrsdBadgeColor = 'secondary';
  readonly removeLabel = output<string>();
}
