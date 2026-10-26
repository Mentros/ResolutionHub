import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, WritableSignal, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { TagApi, TAGS_URL, apiErrorMessage } from '../../core/labels-api';
import {
  CrsdAlert,
  CrsdAlertDescription,
  CrsdBtn,
  CrsdEmpty,
  CrsdEmptyDescription,
  CrsdField,
  CrsdInput,
  CrsdLabel,
  CrsdSpinner,
} from '@mentros/crsd-ui';
import { BackLink } from '../../core/back-link/back-link';
import {
  btnPrimary,
  pageHead,
  pageLede,
  pageSection,
  pageTitle,
} from '../../core/crsd-ui';

@Component({
  selector: 'app-tags-page',
  imports: [
    BackLink,
    CrsdField,
    CrsdLabel,
    CrsdInput,
    CrsdBtn,
    CrsdSpinner,
    CrsdEmpty,
    CrsdEmptyDescription,
    CrsdAlert,
    CrsdAlertDescription,
  ],
  templateUrl: './tags-page.html',
  styles: `
    .labels-scroll {
      scrollbar-gutter: stable;
      scrollbar-width: thin;
    }
  `,
})
export class TagsPage {
  private readonly tagApi = inject(TagApi);

  readonly draft = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  protected readonly pageSection = pageSection;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  protected readonly btnPrimary = btnPrimary;

  private readonly tagResource = httpResource<string[]>(() => ({ url: TAGS_URL }), {
    defaultValue: [] as string[],
  });

  readonly tags = this.tagResource.value;

  readonly loading = () => {
    const status = this.tagResource.status();
    return status === 'loading' || status === 'reloading';
  };

  addTag(event: Event): void {
    event.preventDefault();
    this.addName(this.draft, this.saving, (name) => this.tagApi.create(name), () =>
      this.tagResource.reload(),
    );
  }

  removeTag(name: string): void {
    if (this.saving()) return;
    if (
      !confirm(
        `Bezeichnung „${name}“ entfernen? Sie wird von Vorgängen und Wiki-Einträgen entfernt, die sie verwenden.`,
      )
    ) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.tagApi.delete(name).subscribe({
      next: () => {
        this.saving.set(false);
        this.tagResource.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Die Bezeichnung konnte nicht entfernt werden.'));
      },
    });
  }

  private addName(
    draft: WritableSignal<string>,
    saving: WritableSignal<boolean>,
    create: (name: string) => Observable<{ name: string }>,
    reload: () => void,
  ): void {
    if (saving()) return;
    const name = draft().trim().replace(/\s+/g, ' ');
    if (!name) {
      this.error.set('Gib einen Namen ein.');
      return;
    }
    if (name.includes(',')) {
      this.error.set('Namen dürfen keine Kommas enthalten.');
      return;
    }
    if (name.length > 40) {
      this.error.set('Namen dürfen höchstens 40 Zeichen lang sein.');
      return;
    }

    saving.set(true);
    this.error.set(null);
    create(name).subscribe({
      next: () => {
        draft.set('');
        saving.set(false);
        reload();
      },
      error: (err: unknown) => {
        saving.set(false);
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.error.set('Dieser Name existiert bereits.');
          return;
        }
        this.error.set(apiErrorMessage(err, 'Der Name konnte nicht hinzugefügt werden.'));
      },
    });
  }
}
