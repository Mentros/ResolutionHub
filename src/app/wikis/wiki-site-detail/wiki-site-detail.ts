import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { WIKI_SITES_URL, WikiSiteApi } from '../../core/api/wiki-api';
import { WikiSite } from '../../core/models';
import {
  CrsdAlert,
  CrsdAlertDescription,
  CrsdBtn,
  CrsdConfirmDialog,
  CrsdEmpty,
  CrsdEmptyDescription,
  CrsdSpinner,
} from '@mentros/crsd-ui';
import { BackLink } from '../../core/back-link/back-link';
import { DetailRecordMeta } from '../../core/detail-record-meta/detail-record-meta';
import { pageHead, pageLede, pageSection, pageTitle } from '../../core/ui/crsd-ui';
import { WikiEntryList } from '../wiki-entry-list/wiki-entry-list';

type DetailState =
  | { status: 'loading'; site: null }
  | { status: 'ready'; site: WikiSite }
  | { status: 'missing'; site: null }
  | { status: 'error'; site: null };

@Component({
  selector: 'app-wiki-site-detail',
  imports: [
    RouterLink,
    BackLink,
    DetailRecordMeta,
    WikiEntryList,
    CrsdBtn,
    CrsdConfirmDialog,
    CrsdSpinner,
    CrsdEmpty,
    CrsdEmptyDescription,
    CrsdAlert,
    CrsdAlertDescription,
  ],
  templateUrl: './wiki-site-detail.html',
})
export class WikiSiteDetail {
  protected readonly pageSection = pageSection;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  private readonly api = inject(WikiSiteApi);
  private readonly router = inject(Router);

  private readonly siteId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => Number(params.get('id'))),
      distinctUntilChanged(),
    ),
    { initialValue: Number.NaN },
  );

  private readonly siteResource = httpResource<WikiSite>(() => {
    const id = this.siteId();
    if (!Number.isInteger(id) || id <= 0) {
      return undefined;
    }
    return { url: `${WIKI_SITES_URL}/${id}` };
  });

  readonly state = computed((): DetailState => {
    const id = this.siteId();
    if (!Number.isInteger(id) || id <= 0) {
      return { status: 'missing', site: null };
    }

    const resource = this.siteResource;
    const status = resource.status();
    if (status === 'loading' || status === 'reloading') {
      return { status: 'loading', site: null };
    }
    if (status === 'error') {
      const err = resource.error();
      return {
        status: err instanceof HttpErrorResponse && err.status === 404 ? 'missing' : 'error',
        site: null,
      };
    }
    if (status === 'resolved' || status === 'local') {
      const site = resource.value();
      return site ? { status: 'ready', site } : { status: 'error', site: null };
    }
    return { status: 'loading', site: null };
  });

  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);

  entryLabel(count: number): string {
    return count === 1 ? '1 Seite' : `${count} Seiten`;
  }

  remove(site: WikiSite): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteWikiSite(site.id).subscribe({
      next: () => {
        void this.router.navigateByUrl('/wikis');
      },
      error: () => {
        this.deleting.set(false);
        this.error.set('Das Wiki konnte nicht gelöscht werden.');
      },
    });
  }
}
