import { HttpResourceRef, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { TAGS_URL, issueListRequest } from '../../core/issue-api';
import { IssueSearch } from '../../core/issue-search';
import { IssueSummary } from '../../core/models';
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
  templateUrl: './issue-list.html',
})
export class IssueList {
  protected readonly pageSection = pageSection;
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

  readonly tags = computed(() => tagListValue(this.tagResource));

  private readonly issueResource = httpResource<IssueSummary[]>(
    () => issueListRequest(this.search.query(), this.search.tags()),
    { defaultValue: [] as IssueSummary[] },
  );

  readonly results = computed((): ResultState => listResultState(this.issueResource));

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
    this.selectedTags.set([]);
  }
}

function tagListValue(resource: HttpResourceRef<string[]>): string[] {
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
