import { Component, input, output } from '@angular/core';
import { CrsdBtn, CrsdField, CrsdIcon, CrsdInput, CrsdLabel } from '@mentros/crsd-ui';

@Component({
  selector: 'app-list-search-input',
  imports: [CrsdField, CrsdLabel, CrsdInput, CrsdBtn, CrsdIcon],
  templateUrl: './list-search-input.html',
  styles: ':host { display: block; }',
})
export class ListSearchInput {
  readonly inputId = input.required<string>();
  readonly placeholder = input('');
  readonly value = input('');

  readonly valueChange = output<string>();
  readonly cleared = output<void>();

  onClear(): void {
    this.valueChange.emit('');
    this.cleared.emit();
  }
}
