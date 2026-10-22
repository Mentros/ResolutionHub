import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TAGS_URL, TagApi, apiErrorMessage } from '../../core/issue-api';
import {
  CrsdAlert,
  CrsdAlertDescription,
  CrsdBtn,
  CrsdCard,
  CrsdEmpty,
  CrsdEmptyDescription,
  CrsdField,
  CrsdInput,
  CrsdLabel,
  CrsdSpinner,
} from '@mentros/crsd-ui';
import {
  backLink,
  btnPrimary,
  pageHead,
  pageLede,
  pageSection,
  pageTitle,
} from '../../core/crsd-ui';

@Component({
  selector: 'app-tags-page',
  imports: [
    RouterLink,
    CrsdField,
    CrsdLabel,
    CrsdInput,
    CrsdBtn,
    CrsdCard,
    CrsdSpinner,
    CrsdEmpty,
    CrsdEmptyDescription,
    CrsdAlert,
    CrsdAlertDescription,
  ],
  templateUrl: './tags-page.html',
})
export class TagsPage {
  private readonly api = inject(TagApi);

  readonly draft = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  protected readonly pageSection = pageSection;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  protected readonly backLink = backLink;
  protected readonly btnPrimary = btnPrimary;

  private readonly tagResource = httpResource<string[]>(() => ({ url: TAGS_URL }), {
    defaultValue: [] as string[],
  });

  readonly tags = this.tagResource.value;
  readonly loading = () => {
    const status = this.tagResource.status();
    return status === 'loading' || status === 'reloading';
  };
  readonly loadError = () => this.tagResource.status() === 'error';

  add(event: Event): void {
    event.preventDefault();
    if (this.saving()) return;
    const name = this.draft().trim().replace(/\s+/g, ' ');
    if (!name) {
      this.error.set('Enter a tag name.');
      return;
    }
    if (name.includes(',')) {
      this.error.set('Tag names cannot contain commas.');
      return;
    }
    if (name.length > 40) {
      this.error.set('Tag names must be 40 characters or fewer.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.api.createTag(name).subscribe({
      next: () => {
        this.draft.set('');
        this.saving.set(false);
        this.tagResource.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.error.set('A tag with this name already exists.');
          return;
        }
        this.error.set(apiErrorMessage(err, 'Could not add the tag.'));
      },
    });
  }

  remove(name: string): void {
    if (this.saving()) return;
    if (!confirm(`Remove the "${name}" tag? It will be taken off every issue that uses it.`)) return;

    this.saving.set(true);
    this.error.set(null);
    this.api.deleteTag(name).subscribe({
      next: () => {
        this.saving.set(false);
        this.tagResource.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Could not remove the tag.'));
      },
    });
  }
}
