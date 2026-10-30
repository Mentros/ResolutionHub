import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { IssueApi, apiErrorMessage } from '../../core/api/issue-api';
import { LabelPicker } from '../../core/label-picker/label-picker';
import { TAGS_URL } from '../../core/api/labels-api';
import {
  BASIC_LANGUAGE_TAG,
  TAG_PROGRAMS_URL,
  TagProgramsResponse,
  isBasicSelected,
  filterGeneralTagCatalog,
  mergeSelectedTags,
  programNamesFromGroups,
  programsForParent,
  splitSelectedTags,
} from '../../core/tags/tag-programs';
import { IssueInput } from '../../core/models';
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
import { CheckpointDraft, CheckpointEditor } from '../checkpoint-editor/checkpoint-editor';

@Component({
  selector: 'app-issue-form',
  imports: [
    RouterLink,
    BackLink,
    LabelPicker,
    CheckpointEditor,
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
  templateUrl: './issue-form.html',
})
export class IssueForm {
  protected readonly pageSection = pageSection;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  protected readonly btnPrimary = btnPrimary;
  private readonly api = inject(IssueApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tagPicker = viewChild('generalTagPicker', { read: LabelPicker });
  private readonly programTagPicker = viewChild('programTagPicker', { read: LabelPicker });
  private nextKey = 1;

  readonly editingId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly notFound = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly title = signal('');
  readonly summary = signal('');
  readonly generalTags = signal<string[]>([]);
  readonly programTags = signal<string[]>([]);
  readonly checkpoints = signal<CheckpointDraft[]>([this.blankCheckpoint()]);

  private readonly tagResource = httpResource<string[]>(() => ({ url: TAGS_URL }), {
    defaultValue: [] as string[],
  });

  private readonly programGroupsResource = httpResource<TagProgramsResponse>(
    () => ({ url: TAG_PROGRAMS_URL }),
    { defaultValue: { groups: [] } },
  );

  readonly programGroups = computed(() =>
    this.programGroupsResource.status() === 'error'
      ? []
      : this.programGroupsResource.value().groups,
  );

  readonly programNameSet = computed(() => programNamesFromGroups(this.programGroups()));

  readonly knownTags = computed(() =>
    this.tagResource.status() === 'error' ? [] : this.tagResource.value(),
  );

  readonly generalTagCatalog = computed(() =>
    filterGeneralTagCatalog(this.knownTags(), this.programNameSet()),
  );

  readonly basicProgramCatalog = computed(() =>
    programsForParent(this.programGroups(), BASIC_LANGUAGE_TAG),
  );

  readonly showProgramPicker = computed(() => isBasicSelected(this.generalTags()));

  constructor() {
    effect(() => {
      if (!isBasicSelected(this.generalTags()) && this.programTags().length > 0) {
        this.programTags.set([]);
      }
    });

    this.route.paramMap
      .pipe(
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
          return this.api.getIssue(id).pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.notFound.set(error instanceof HttpErrorResponse && error.status === 404);
              if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
                this.error.set('Dieses Ticket konnte nicht geladen werden.');
              }
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((issue) => {
        if (!issue) return;
        this.title.set(issue.title);
        this.summary.set(issue.summary);
        const { general, programs } = splitSelectedTags(issue.tags, this.programNameSet());
        this.generalTags.set(general);
        this.programTags.set(programs);
        this.checkpoints.set(
          issue.checkpoints.length > 0
            ? issue.checkpoints.map((step) => ({
                key: this.nextKey++,
                instruction: step.instruction,
                wikiUrl: step.wikiUrl ?? '',
                sharePath: step.sharePath ?? '',
              }))
            : [this.blankCheckpoint()],
        );
        this.loading.set(false);
      });
  }

  readonly heading = computed(() => (this.editingId() == null ? 'Neues Ticket' : 'Ticket bearbeiten'));

  save(event: Event): void {
    event.preventDefault();
    if (this.saving()) return;
    if (this.tagPicker()?.commitDraft() === false) return;
    if (this.programTagPicker()?.commitDraft() === false) return;
    const input = this.toInput();
    if (!input) return;

    this.saving.set(true);
    this.error.set(null);
    const id = this.editingId();
    const request = id == null ? this.api.createIssue(input) : this.api.updateIssue(id, input);
    request.subscribe({
      next: (issue) => {
        void this.router.navigate(['/issues', issue.id]);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error, 'Das Ticket konnte nicht gespeichert werden.'));
      },
    });
  }

  private toInput(): IssueInput | null {
    const title = this.title().trim();
    if (!title) {
      this.error.set('Der Titel ist erforderlich.');
      return null;
    }
    if (title.length > 200) {
      this.error.set('Der Titel darf höchstens 200 Zeichen lang sein.');
      return null;
    }
    const checkpoints: IssueInput['checkpoints'] = [];
    for (const row of this.checkpoints()) {
      const instruction = row.instruction.trim();
      const wikiUrl = row.wikiUrl.trim();
      const sharePath = row.sharePath.trim();
      if (!instruction && !wikiUrl && !sharePath) continue;
      if (wikiUrl && !isHttpUrl(wikiUrl)) {
        this.error.set('Externe Dokumentation muss eine gültige http- oder https-Adresse sein.');
        return null;
      }
      checkpoints.push({
        instruction,
        wikiUrl: wikiUrl || null,
        sharePath: sharePath || null,
      });
    }
    return {
      title,
      summary: this.summary().trim(),
      tags: mergeSelectedTags(this.generalTags(), this.programTags()),
      checkpoints,
    };
  }

  private reset(): void {
    this.title.set('');
    this.summary.set('');
    this.generalTags.set([]);
    this.programTags.set([]);
    this.checkpoints.set([this.blankCheckpoint()]);
  }

  private blankCheckpoint(): CheckpointDraft {
    return { key: this.nextKey++, instruction: '', wikiUrl: '', sharePath: '' };
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
