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
  tags: string[];
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
  @Input({ required: true }) tagCatalog!: Signal<string[]>;

  readonly tagPick = signal<Record<number, string | null>>({});

  tagOptions(key: number): CrsdOption[] {
    const row = this.entries().find((entry) => entry.key === key);
    const chosen = new Set((row?.tags ?? []).map((name) => name.toLowerCase()));
    return this.tagCatalog()
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

  addTag(key: number, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = this.tagCatalog().find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
    if (!existing) return;
    this.entries.update((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        if (row.tags.some((entry) => entry.toLowerCase() === existing.toLowerCase())) return row;
        return { ...row, tags: [...row.tags, existing] };
      }),
    );
  }

  removeTag(key: number, name: string): void {
    this.entries.update((rows) =>
      rows.map((row) =>
        row.key === key ? { ...row, tags: row.tags.filter((entry) => entry !== name) } : row,
      ),
    );
  }

  onTagPick(key: number, value: string | null): void {
    if (value) this.addTag(key, value);
    this.tagPick.update((state) => ({ ...state, [key]: null }));
  }

  tagPickerValue(key: number): string | null {
    return this.tagPick()[key] ?? null;
  }
}

function blankEntry(rows: WikiEntryDraft[]): WikiEntryDraft {
  const key = rows.reduce((max, row) => Math.max(max, row.key), 0) + 1;
  return { key, title: '', pageUrl: '', notes: '', tags: [] };
}
