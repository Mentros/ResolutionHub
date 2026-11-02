import { httpResource } from '@angular/common/http';
import { Component, computed, input } from '@angular/core';
import {
  LocationSuggestionsResponse,
  locationSuggestionsUrl,
  type LocationSuggestionKind,
} from '../api/locations-api';

@Component({
  selector: 'app-location-suggest-datalist',
  template: `
    <datalist [id]="listId()">
      @for (item of suggestions(); track item.value) {
        <option [value]="item.value" [attr.label]="item.hint ?? null"></option>
      }
    </datalist>
  `,
})
export class LocationSuggestDatalist {
  readonly listId = input.required<string>();
  readonly kind = input.required<LocationSuggestionKind>();

  private readonly resource = httpResource<LocationSuggestionsResponse>(
    () => ({ url: locationSuggestionsUrl(this.kind()) }),
    { defaultValue: { suggestions: [] } },
  );

  readonly suggestions = computed(() =>
    this.resource.status() === 'error' ? [] : this.resource.value().suggestions,
  );
}
