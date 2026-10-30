import { HttpResourceRef, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { TAGS_URL } from '../../core/api/labels-api';
import { WikiSiteSummary } from '../../core/models';
import {
  BASIC_LANGUAGE_TAG,
  TAG_PROGRAMS_URL,
  TagProgramsResponse,
  isBasicSelected,
  mergeSelectedTags,
  filterGeneralTagCatalog,
  programNamesFromGroups,
  programsForParent,
  splitSelectedTags,
} from '../../core/tags/tag-programs';
import { wikiSiteListRequest } from '../../core/api/wiki-api';
import { WikiSearch } from '../../core/search/wiki-search';
import {
  CrsdAlert,
  CrsdAlertDescription,
  CrsdBtn,
  CrsdEmpty,
  CrsdEmptyDescription,
  CrsdSpinner,
} from '@mentros/crsd-ui';
import {
  pageHead,
  pageLede,
  pageResults,
  pageSearchPanel,
  pageSection,
  pageTitle,
} from '../../core/ui/crsd-ui';
import { ListSearchInput } from '../../core/list/list-search-input/list-search-input';
import { wireListQueryUrlSync } from '../../core/list/list-query-url-sync';
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
    ListSearchInput,
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
  protected readonly pageResults = pageResults;
  protected readonly pageSearchPanel = pageSearchPanel;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  readonly search = inject(WikiSearch);
  readonly selectedTags = this.search.tags;
  readonly draft = signal(this.search.query());

  readonly hasFilter = computed(
    () => this.search.query().trim().length > 0 || this.selectedTags().length > 0,
  );

  private readonly queryChanges = new Subject<string>();

  private readonly tagResource = httpResource<string[]>(() => ({ url: TAGS_URL }), {
    defaultValue: [] as string[],
  });

  private readonly programGroupsResource = httpResource<TagProgramsResponse>(
    () => ({ url: TAG_PROGRAMS_URL }),
    { defaultValue: { groups: [] } },
  );

  readonly tagCatalog = computed(() => catalogValue(this.tagResource));

  readonly programGroups = computed(() =>
    this.programGroupsResource.status() === 'error'
      ? []
      : this.programGroupsResource.value().groups,
  );

  readonly programNameSet = computed(() => programNamesFromGroups(this.programGroups()));

  readonly generalTagCatalog = computed(() =>
    filterGeneralTagCatalog(this.tagCatalog(), this.programNameSet()),
  );

  readonly basicProgramCatalog = computed(() =>
    programsForParent(this.programGroups(), BASIC_LANGUAGE_TAG),
  );

  readonly showProgramFilter = computed(() => {
    const { general } = splitSelectedTags(this.selectedTags(), this.programNameSet());
    return isBasicSelected(general);
  });

  private readonly siteResource = httpResource<WikiSiteSummary[]>(
    () => wikiSiteListRequest(this.search.query(), this.search.tags()),
    { defaultValue: [] as WikiSiteSummary[] },
  );

  readonly results = computed((): ResultState => listResultState(this.siteResource));

  private readonly tagFilter = viewChild('generalTagFilter', { read: TagFilter });
  private readonly programTagFilter = viewChild('programTagFilter', { read: TagFilter });

  readonly resultCountLabel = computed(() => {
    const count = this.results().status === 'ready' ? this.results().sites.length : 0;
    return count === 1 ? '1 Wiki' : `${count} Wikis`;
  });

  constructor() {
    wireListQueryUrlSync({
      query: this.search.query,
      tags: this.search.tags,
      draft: this.draft,
    });

    this.queryChanges.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((value) => {
      this.search.query.set(value);
    });

    effect(() => {
      const tags = this.selectedTags();
      const { general, programs } = splitSelectedTags(tags, this.programNameSet());
      if (!isBasicSelected(general) && programs.length > 0) {
        this.selectedTags.set(mergeSelectedTags(general, []));
      }
    });
  }

  onQueryInput(value: string): void {
    this.draft.set(value);
    this.queryChanges.next(value);
  }

  onSearchCleared(): void {
    this.draft.set('');
    this.search.query.set('');
  }

  clearFilters(): void {
    this.draft.set('');
    this.search.query.set('');
    this.selectedTags.set([]);
    this.tagFilter()?.resetChipQuery();
    this.programTagFilter()?.resetChipQuery();
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
