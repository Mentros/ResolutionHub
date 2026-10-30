import { HttpResourceRef, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { issueListRequest } from '../../core/api/issue-api';
import { TAGS_URL } from '../../core/api/labels-api';
import { IssueSearch } from '../../core/search/issue-search';
import { IssueSummary } from '../../core/models';
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
import { IssueCard } from '../issue-card/issue-card';
import { TagFilter } from '../tag-filter/tag-filter';

type ResultState =
  | { status: 'loading'; issues: IssueSummary[] }
  | { status: 'ready'; issues: IssueSummary[] }
  | { status: 'error'; issues: IssueSummary[] };

@Component({
  selector: 'app-issue-list',
  imports: [
    RouterLink,
    IssueCard,
    TagFilter,
    ListSearchInput,
    CrsdBtn,
    CrsdSpinner,
    CrsdEmpty,
    CrsdEmptyDescription,
    CrsdAlert,
    CrsdAlertDescription,
  ],
  templateUrl: './issue-list.html',
})
export class IssueList {
  protected readonly pageSection = pageSection;
  protected readonly pageResults = pageResults;
  protected readonly pageSearchPanel = pageSearchPanel;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  readonly search = inject(IssueSearch);
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

  private readonly issueResource = httpResource<IssueSummary[]>(
    () => issueListRequest(this.search.query(), this.search.tags()),
    { defaultValue: [] as IssueSummary[] },
  );

  readonly results = computed((): ResultState => listResultState(this.issueResource));

  private readonly tagFilter = viewChild('generalTagFilter', { read: TagFilter });
  private readonly programTagFilter = viewChild('programTagFilter', { read: TagFilter });

  readonly resultCountLabel = computed(() => {
    const count = this.results().status === 'ready' ? this.results().issues.length : 0;
    return count === 1 ? '1 Ticket' : `${count} Tickets`;
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

function listResultState(resource: HttpResourceRef<IssueSummary[]>): ResultState {
  const status = resource.status();
  if (status === 'loading' || status === 'reloading') {
    return { status: 'loading', issues: resource.value() };
  }
  if (status === 'error') {
    return { status: 'error', issues: [] };
  }
  return { status: 'ready', issues: resource.value() };
}
