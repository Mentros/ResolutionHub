import { HttpResourceRef, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { PROGRAMS_URL, WIKI_TOPICS_URL } from '../../core/labels-api';
import { WikiSiteSummary } from '../../core/models';
import { wikiSiteListRequest } from '../../core/wiki-api';
import { WikiSearch } from '../../core/wiki-search';
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
import { pageHead, pageLede, pageSection, pageTitle } from '../../core/crsd-ui';
import { TagFilter } from '../../issues/tag-filter/tag-filter';
import { WikiSiteCard } from '../wiki-site-card/wiki-site-card';

type ResultState =
  | { status: 'loading'; sites: WikiSiteSummary[] }
  | { status: 'ready'; sites: WikiSiteSummary[] }
  | { status: 'error'; sites: WikiSiteSummary[] };

@Component({
  selector: 'app-wiki-site-list',
  imports: [
    RouterLink,
    WikiSiteCard,
    TagFilter,
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
  templateUrl: './wiki-site-list.html',
})
export class WikiSiteList {
  protected readonly pageSection = pageSection;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  readonly search = inject(WikiSearch);
  readonly selectedPrograms = this.search.programs;
  readonly selectedTopics = this.search.topics;
  readonly draft = signal(this.search.query());
  readonly hasFilter = computed(
    () =>
      this.search.query().trim().length > 0 ||
      this.selectedPrograms().length > 0 ||
      this.selectedTopics().length > 0,
  );

  private readonly queryChanges = new Subject<string>();

  private readonly programResource = httpResource<string[]>(() => ({ url: PROGRAMS_URL }), {
    defaultValue: [] as string[],
  });

  private readonly topicResource = httpResource<string[]>(() => ({ url: WIKI_TOPICS_URL }), {
    defaultValue: [] as string[],
  });

  readonly programs = computed(() => catalogValue(this.programResource));
  readonly topics = computed(() => catalogValue(this.topicResource));

  private readonly siteResource = httpResource<WikiSiteSummary[]>(
    () =>
      wikiSiteListRequest(this.search.query(), this.search.programs(), this.search.topics()),
    { defaultValue: [] as WikiSiteSummary[] },
  );

  readonly results = computed((): ResultState => listResultState(this.siteResource));

  constructor() {
    this.queryChanges.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((value) => {
      this.search.query.set(value);
    });
  }

  onQueryInput(value: string): void {
    this.draft.set(value);
    this.queryChanges.next(value);
  }

  clearFilters(): void {
    this.draft.set('');
    this.search.query.set('');
    this.selectedPrograms.set([]);
    this.selectedTopics.set([]);
  }
}

function catalogValue(resource: HttpResourceRef<string[]>): string[] {
  return resource.status() === 'error' ? [] : resource.value();
}

function listResultState(resource: HttpResourceRef<WikiSiteSummary[]>): ResultState {
  const status = resource.status();
  if (status === 'loading' || status === 'reloading') {
    return { status: 'loading', sites: resource.value() };
  }
  if (status === 'error') {
    return { status: 'error', sites: [] };
  }
  return { status: 'ready', sites: resource.value() };
}
