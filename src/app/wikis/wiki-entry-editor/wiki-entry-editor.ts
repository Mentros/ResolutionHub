import { Component, Input, Signal, WritableSignal, signal } from '@angular/core';
import {
  CrsdBtn,
  CrsdCard,
  CrsdField,
  CrsdFieldDescription,
  CrsdInput,
  CrsdLabel,
  CrsdTextarea,
  CrsdSelect,
  CrsdSelectContent,
  CrsdSelectPlaceholder,
  CrsdSelectPortal,
  CrsdSelectTrigger,
  CrsdIcon,
  type CrsdOption,
} from '@mentros/crsd-ui';
import { RemovableLabelChips } from '../../core/label-chips/removable-label-chips';

export interface WikiEntryDraft {
  key: number;
  title: string;
  pageUrl: string;
  notes: string;
  programs: string[];
  topics: string[];
}

@Component({
  selector: 'app-wiki-entry-editor',
  imports: [
    CrsdCard,
    CrsdField,
    CrsdFieldDescription,
    CrsdLabel,
    CrsdInput,
    CrsdTextarea,
    CrsdBtn,
    RemovableLabelChips,
    CrsdSelect,
    CrsdSelectTrigger,
    CrsdSelectPortal,
    CrsdSelectContent,
    CrsdSelectPlaceholder,
    CrsdIcon,
  ],
  templateUrl: './wiki-entry-editor.html',
  styles: ':host { display: contents; }',
})
export class WikiEntryEditor {
  @Input({ required: true }) entries!: WritableSignal<WikiEntryDraft[]>;
  @Input({ required: true }) programCatalog!: Signal<string[]>;
  @Input({ required: true }) topicCatalog!: Signal<string[]>;

  readonly programPick = signal<Record<number, string | null>>({});
  readonly topicPick = signal<Record<number, string | null>>({});

  programOptions(key: number): CrsdOption[] {
    const row = this.entries().find((entry) => entry.key === key);
    const chosen = new Set((row?.programs ?? []).map((name) => name.toLowerCase()));
    return this.programCatalog()
      .filter((name) => !chosen.has(name.toLowerCase()))
      .map((name) => ({ value: name, label: name }));
  }

  topicOptions(key: number): CrsdOption[] {
    const row = this.entries().find((entry) => entry.key === key);
    const chosen = new Set((row?.topics ?? []).map((name) => name.toLowerCase()));
    return this.topicCatalog()
      .filter((name) => !chosen.has(name.toLowerCase()))
      .map((name) => ({ value: name, label: name }));
  }

  add(): void {
    this.entries.update((rows) => [...rows, blankEntry(rows)]);
  }

  remove(key: number): void {
    this.entries.update((rows) => {
      const next = rows.filter((row) => row.key !== key);
      return next.length > 0 ? next : [blankEntry(rows)];
    });
  }

  move(key: number, delta: number): void {
    this.entries.update((rows) => {
      const next = rows.slice();
      const index = next.findIndex((row) => row.key === key);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= next.length) return rows;
      const [row] = next.splice(index, 1);
      if (!row) return rows;
      next.splice(target, 0, row);
      return next;
    });
  }

  setField(key: number, field: 'title' | 'pageUrl' | 'notes', value: string): void {
    this.entries.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  addLabel(key: number, field: 'programs' | 'topics', name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const catalog = field === 'programs' ? this.programCatalog() : this.topicCatalog();
    const existing = catalog.find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
    if (!existing) return;
    this.entries.update((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        const list = row[field];
        if (list.some((entry) => entry.toLowerCase() === existing.toLowerCase())) return row;
        return { ...row, [field]: [...list, existing] };
      }),
    );
  }

  removeLabel(key: number, field: 'programs' | 'topics', name: string): void {
    this.entries.update((rows) =>
      rows.map((row) =>
        row.key === key ? { ...row, [field]: row[field].filter((entry) => entry !== name) } : row,
      ),
    );
  }

  onProgramPick(key: number, value: string | null): void {
    if (value) this.addLabel(key, 'programs', value);
    this.programPick.update((state) => ({ ...state, [key]: null }));
  }

  onTopicPick(key: number, value: string | null): void {
    if (value) this.addLabel(key, 'topics', value);
    this.topicPick.update((state) => ({ ...state, [key]: null }));
  }

  programPickerValue(key: number): string | null {
    return this.programPick()[key] ?? null;
  }

  topicPickerValue(key: number): string | null {
    return this.topicPick()[key] ?? null;
  }
}

function blankEntry(rows: WikiEntryDraft[]): WikiEntryDraft {
  const key = rows.reduce((max, row) => Math.max(max, row.key), 0) + 1;
  return { key, title: '', pageUrl: '', notes: '', programs: [], topics: [] };
}
