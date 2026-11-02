import { Component, input, output } from '@angular/core';
import { CrsdInput } from '@mentros/crsd-ui';
import { LocationSuggestDatalist } from '../location-suggest-datalist/location-suggest-datalist';
import { type LocationSuggestionKind } from '../api/locations-api';

@Component({
  selector: 'app-location-suggest-input',
  imports: [CrsdInput, LocationSuggestDatalist],
  templateUrl: './location-suggest-input.html',
  styles: ':host { display: contents; }',
})
export class LocationSuggestInput {
  readonly inputId = input.required<string>();
  readonly listId = input.required<string>();
  readonly kind = input.required<LocationSuggestionKind>();
  readonly value = input.required<string>();
  readonly placeholder = input<string>('');
  readonly type = input<string>('text');
  readonly spellcheck = input<boolean | string>(false);
  readonly inputClass = input<string>('');

  readonly valueChange = output<string>();
}
