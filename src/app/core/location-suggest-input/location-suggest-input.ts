import { httpResource } from '@angular/common/http';
import { Component, computed, input, output } from '@angular/core';
import {
  CrsdAutocomplete,
  CrsdAutocompleteContent,
  CrsdAutocompletePortal,
  CrsdAutocompleteTrigger,
  CrsdInput,
  type CrsdOption,
} from '@mentros/crsd-ui';
import {
  LocationSuggestionsResponse,
  locationSuggestionsUrl,
  type LocationSuggestionKind,
} from '../api/locations-api';

@Component({
  selector: 'app-location-suggest-input',
  imports: [
    CrsdInput,
    CrsdAutocomplete,
    CrsdAutocompleteTrigger,
    CrsdAutocompletePortal,
    CrsdAutocompleteContent,
  ],
  templateUrl: './location-suggest-input.html',
  styles: ':host { display: contents; }',
})
export class LocationSuggestInput {
  readonly inputId = input.required<string>();
  readonly kind = input.required<LocationSuggestionKind>();
  readonly value = input.required<string>();
  readonly placeholder = input<string>('');
  readonly type = input<string>('text');
  readonly spellcheck = input<boolean | string>(false);
  readonly inputClass = input<string>('');

  readonly entered = output<string>();

  private readonly resource = httpResource<LocationSuggestionsResponse>(
    () => ({ url: locationSuggestionsUrl(this.kind()) }),
    { defaultValue: { suggestions: [] } },
  );

  readonly options = computed((): CrsdOption<string>[] => {
    const rows =
      this.resource.status() === 'error' ? [] : this.resource.value().suggestions;
    return rows.map((item) => ({
      value: item.value,
      label: item.hint ?? '',
    }));
  });
}
