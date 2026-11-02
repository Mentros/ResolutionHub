import {
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  CrsdAlert,
  CrsdAlertDescription,
  CrsdBtn,
  CrsdDialog,
  CrsdDialogClose,
  CrsdDialogContent,
  CrsdDialogDescription,
  CrsdDialogFooter,
  CrsdDialogHeader,
  CrsdDialogPortal,
  CrsdDialogTitle,
  CrsdDialogTrigger,
  CrsdField,
  CrsdFieldDescription,
  CrsdIcon,
  CrsdInput,
  CrsdLabel,
  CrsdSpinner,
  type CrsdOpenState,
} from '@mentros/crsd-ui';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../api/issue-api';
import { listQueryParamsForRouter, queryParamsForTagFilter } from '../list/list-query-params';
import { GlobalSearchResult } from '../models';
import { GlobalSearchApi } from '../api/global-search-api';
import { TAG_PROGRAMS_URL, TagProgramsResponse, parentForProgram } from '../tags/tag-programs';
import { TagList } from '../../issues/tag-list/tag-list';

const EMPTY_RESULTS: GlobalSearchResult = { issues: [], wikiSites: [] };

@Component({
  selector: 'app-global-search',
  imports: [
    RouterLink,
    CrsdBtn,
    CrsdIcon,
    CrsdDialog,
    CrsdDialogTrigger,
    CrsdDialogPortal,
    CrsdDialogContent,
    CrsdDialogHeader,
    CrsdDialogTitle,
    CrsdDialogDescription,
    CrsdDialogFooter,
    CrsdDialogClose,
    CrsdField,
    CrsdFieldDescription,
    CrsdLabel,
    CrsdInput,
    CrsdSpinner,
    CrsdAlert,
    CrsdAlertDescription,
    TagList,
  ],
  templateUrl: './global-search.html',
})
export class GlobalSearch {
  private readonly api = inject(GlobalSearchApi);
  private readonly router = inject(Router);

  private readonly programGroupsResource = httpResource<TagProgramsResponse>(
    () => ({ url: TAG_PROGRAMS_URL }),
    { defaultValue: { groups: [] } },
  );

  readonly programGroups = computed(() =>
    this.programGroupsResource.status() === 'error'
      ? []
      : this.programGroupsResource.value().groups,
  );

  readonly dialogState = signal<CrsdOpenState>('closed');
  readonly draft = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly results = signal<GlobalSearchResult>(EMPTY_RESULTS);

  readonly empty = computed(
    () =>
      this.results().issues.length === 0 &&
      this.results().wikiSites.length === 0 &&
      this.draft().trim().length > 0 &&
      !this.loading(),
  );

  private readonly queryChanges = new Subject<string>();

  constructor() {
    this.queryChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmed = query.trim();
          if (!trimmed) {
            this.loading.set(false);
            this.error.set(null);
            this.results.set(EMPTY_RESULTS);
            return of(null);
          }
          this.loading.set(true);
          this.error.set(null);
          return this.api.search(trimmed).pipe(
            catchError((err: unknown) => {
              this.loading.set(false);
              this.results.set(EMPTY_RESULTS);
              this.error.set(apiErrorMessage(err, 'Die Suche ist fehlgeschlagen.'));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((payload) => {
        if (payload === null) return;
        this.loading.set(false);
        this.results.set(payload);
      });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    ) {
      return;
    }
    event.preventDefault();
    this.resetSearchState();
    this.dialogState.set('open');
  }

  onDialogStateChange(state: CrsdOpenState): void {
    this.dialogState.set(state);
    if (state === 'open' || state === 'closed') {
      this.resetSearchState();
    }
  }

  private resetSearchState(): void {
    this.draft.set('');
    this.queryChanges.next('');
    this.results.set(EMPTY_RESULTS);
    this.error.set(null);
    this.loading.set(false);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.set(value);
    this.queryChanges.next(value);
  }

  listQueryForDraft(): Record<string, string | string[] | null> {
    return listQueryParamsForRouter(this.draft(), []);
  }

  openIssue(id: number): void {
    this.dialogState.set('closed');
    void this.router.navigate(['/issues', id]);
  }

  openWiki(id: number): void {
    this.dialogState.set('closed');
    void this.router.navigate(['/wikis', id]);
  }

  navigateIssueTag = (tag: string): void => {
    this.navigateTagFilter('/', tag);
  };

  navigateWikiTag = (tag: string): void => {
    this.navigateTagFilter('/wikis', tag);
  };

  private navigateTagFilter(path: string, tag: string): void {
    this.dialogState.set('closed');
    const parent = parentForProgram(this.programGroups(), tag);
    void this.router.navigate([path], {
      queryParams: queryParamsForTagFilter(tag, parent ? [parent] : []),
    });
  }
}
