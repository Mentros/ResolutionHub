import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { isValidWikiLocation } from '../../core/util/documentation-location';
import { apiErrorMessage } from '../../core/api/issue-api';
import { TAGS_URL } from '../../core/api/labels-api';
import { WikiSiteInput } from '../../core/models';
import { WikiSiteApi } from '../../core/api/wiki-api';
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
  CrsdTextarea,
} from '@mentros/crsd-ui';
import { BackLink } from '../../core/back-link/back-link';
import {
  btnPrimary,
  pageHead,
  pageLede,
  pageSection,
  pageTitle,
} from '../../core/ui/crsd-ui';
import { WikiEntryDraft, WikiEntryEditor } from '../wiki-entry-editor/wiki-entry-editor';

@Component({
  selector: 'app-wiki-site-form',
  imports: [
    RouterLink,
    BackLink,
    WikiEntryEditor,
    CrsdField,
    CrsdLabel,
    CrsdInput,
    CrsdTextarea,
    CrsdBtn,
    CrsdSpinner,
    CrsdEmpty,
    CrsdEmptyDescription,
    CrsdAlert,
    CrsdAlertDescription,
  ],
  templateUrl: './wiki-site-form.html',
})
export class WikiSiteForm {
  protected readonly pageSection = pageSection;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  protected readonly btnPrimary = btnPrimary;
  private readonly api = inject(WikiSiteApi);
  private readonly router = inject(Router);
  private nextKey = 1;

  readonly editingId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly notFound = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly name = signal('');
  readonly summary = signal('');
  readonly entries = signal<WikiEntryDraft[]>([this.blankEntry()]);

  private readonly tagResource = httpResource<string[]>(() => ({ url: TAGS_URL }), {
    defaultValue: [] as string[],
  });

  readonly tagCatalog = computed(() =>
    this.tagResource.status() === 'error' ? [] : this.tagResource.value(),
  );

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        switchMap((raw) => {
          this.error.set(null);
          if (!raw) {
            this.editingId.set(null);
            this.notFound.set(false);
            this.loading.set(false);
            this.reset();
            return of(null);
          }
          const id = Number(raw);
          this.editingId.set(id);
          this.loading.set(true);
          this.notFound.set(false);
          return this.api.getWikiSite(id).pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.notFound.set(error instanceof HttpErrorResponse && error.status === 404);
              if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
                this.error.set('Dieses Wiki konnte nicht geladen werden.');
              }
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((site) => {
        if (!site) return;
        this.name.set(site.name);
        this.summary.set(site.summary);
        this.entries.set(
          site.entries.length > 0
            ? site.entries.map((entry) => ({
                key: this.nextKey++,
                title: entry.title,
                locations: entry.locations.length > 0 ? [...entry.locations] : [''],
                notes: entry.notes,
                tags: entry.tags,
              }))
            : [this.blankEntry()],
        );
        this.loading.set(false);
      });
  }

  readonly heading = computed(() => (this.editingId() == null ? 'Neues Wiki' : 'Wiki bearbeiten'));

  save(event: Event): void {
    event.preventDefault();
    if (this.saving()) return;
    const input = this.toInput();
    if (!input) return;

    this.saving.set(true);
    this.error.set(null);
    const id = this.editingId();
    const request = id == null ? this.api.createWikiSite(input) : this.api.updateWikiSite(id, input);
    request.subscribe({
      next: (site) => {
        void this.router.navigate(['/wikis', site.id]);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error, 'Das Wiki konnte nicht gespeichert werden.'));
      },
    });
  }

  private toInput(): WikiSiteInput | null {
    const name = this.name().trim();
    if (!name) {
      this.error.set('Der Name ist erforderlich.');
      return null;
    }
    const wikiEntries: WikiSiteInput['entries'] = [];
    for (const row of this.entries()) {
      const title = row.title.trim();
      const notes = row.notes.trim();
      const locations = row.locations.map((loc) => loc.trim()).filter(Boolean);
      if (!title && locations.length === 0 && !notes && row.tags.length === 0) {
        continue;
      }
      if (!title) {
        this.error.set('Jeder Eintrag braucht einen Titel.');
        return null;
      }
      for (const loc of locations) {
        if (!isValidWikiLocation(loc)) {
          this.error.set(
            'Jeder Fundort muss eine gültige http- oder https-Adresse oder ein UNC-Pfad (\\\\server\\share\\…) sein.',
          );
          return null;
        }
      }
      if (locations.length === 0 && !notes) {
        this.error.set('Jeder Eintrag braucht mindestens einen Fundort oder eine Notiz.');
        return null;
      }
      wikiEntries.push({
        title,
        locations,
        notes,
        tags: row.tags,
      });
    }
    return {
      name,
      summary: this.summary().trim(),
      entries: wikiEntries,
    };
  }

  private reset(): void {
    this.name.set('');
    this.summary.set('');
    this.entries.set([this.blankEntry()]);
  }

  private blankEntry(): WikiEntryDraft {
    return { key: this.nextKey++, title: '', locations: [''], notes: '', tags: [] };
  }
}
