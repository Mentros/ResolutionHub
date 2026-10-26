import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, WritableSignal, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ProgramApi,
  WikiTopicApi,
  PROGRAMS_URL,
  WIKI_TOPICS_URL,
  apiErrorMessage,
} from '../../core/labels-api';
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
  private readonly programApi = inject(ProgramApi);
  private readonly topicApi = inject(WikiTopicApi);

  readonly programDraft = signal('');
  readonly topicDraft = signal('');
  readonly savingProgram = signal(false);
  readonly savingTopic = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<'programs' | 'topics'>('programs');
  protected readonly pageSection = pageSection;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  protected readonly btnPrimary = btnPrimary;

  private readonly programResource = httpResource<string[]>(() => ({ url: PROGRAMS_URL }), {
    defaultValue: [] as string[],
  });

  private readonly topicResource = httpResource<string[]>(() => ({ url: WIKI_TOPICS_URL }), {
    defaultValue: [] as string[],
  });

  readonly programs = this.programResource.value;
  readonly topics = this.topicResource.value;

  readonly loadingPrograms = () => {
    const status = this.programResource.status();
    return status === 'loading' || status === 'reloading';
  };

  readonly loadingTopics = () => {
    const status = this.topicResource.status();
    return status === 'loading' || status === 'reloading';
  };

  addProgram(event: Event): void {
    event.preventDefault();
    this.addName(this.programDraft, this.savingProgram, (name) => this.programApi.create(name), () =>
      this.programResource.reload(),
    );
  }

  addTopic(event: Event): void {
    event.preventDefault();
    this.addName(this.topicDraft, this.savingTopic, (name) => this.topicApi.create(name), () =>
      this.topicResource.reload(),
    );
  }

  removeProgram(name: string): void {
    if (this.savingProgram() || this.savingTopic()) return;
    if (
      !confirm(
        `Programm „${name}“ entfernen? Es wird von jedem Vorgang und jeder Wiki-Seite entfernt, die es verwenden.`,
      )
    ) {
      return;
    }
    this.savingProgram.set(true);
    this.error.set(null);
    this.programApi.delete(name).subscribe({
      next: () => {
        this.savingProgram.set(false);
        this.programResource.reload();
      },
      error: (err: unknown) => {
        this.savingProgram.set(false);
        this.error.set(apiErrorMessage(err, 'Das Programm konnte nicht entfernt werden.'));
      },
    });
  }

  removeTopic(name: string): void {
    if (this.savingProgram() || this.savingTopic()) return;
    if (!confirm(`Wiki-Thema „${name}“ entfernen? Es wird von jeder Wiki-Seite entfernt, die es verwendet.`)) {
      return;
    }
    this.savingTopic.set(true);
    this.error.set(null);
    this.topicApi.delete(name).subscribe({
      next: () => {
        this.savingTopic.set(false);
        this.topicResource.reload();
      },
      error: (err: unknown) => {
        this.savingTopic.set(false);
        this.error.set(apiErrorMessage(err, 'Das Wiki-Thema konnte nicht entfernt werden.'));
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
