import { Component, Input, Signal, WritableSignal, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CrsdBadge,
  CrsdField,
  CrsdFieldDescription,
  CrsdIcon,
  CrsdLabel,
  CrsdSelect,
  CrsdSelectContent,
  CrsdSelectPlaceholder,
  CrsdSelectPortal,
  CrsdSelectTrigger,
  CrsdAlert,
  CrsdAlertDescription,
  type CrsdOption,
} from '@mentros/crsd-ui';

@Component({
  selector: 'app-tag-editor',
  imports: [
    RouterLink,
    CrsdField,
    CrsdLabel,
    CrsdBadge,
    CrsdFieldDescription,
    CrsdSelect,
    CrsdSelectTrigger,
    CrsdSelectPortal,
    CrsdSelectContent,
    CrsdSelectPlaceholder,
    CrsdIcon,
    CrsdAlert,
    CrsdAlertDescription,
  ],
  templateUrl: './tag-editor.html',
  styles: ':host { display: contents; }',
})
export class TagEditor {
  @Input({ required: true }) tags!: WritableSignal<string[]>;
  @Input({ required: true }) knownTags!: Signal<string[]>;
  readonly pickerValue = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly pickableOptions = computed((): CrsdOption[] => {
    const selected = new Set(this.tags().map((tag) => tag.toLowerCase()));
    return this.knownTags()
      .filter((tag) => !selected.has(tag.toLowerCase()))
      .map((tag) => ({ value: tag, label: tag }));
  });

  /** Kept for issue save flow; select commits immediately on pick. */
  commitDraft(): boolean {
    return true;
  }

  onPick(value: string | null): void {
    this.pickerValue.set(value);
    if (!value) return;
    if (this.addTag(value)) {
      this.pickerValue.set(null);
    }
  }

  addTag(name: string): boolean {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      return true;
    }
    if (trimmed.includes(',')) {
      this.error.set('Tag names cannot contain commas.');
      return false;
    }
    if (trimmed.length > 40) {
      this.error.set('Tag names must be 40 characters or fewer.');
      return false;
    }
    const existing = this.knownTags().find((tag) => tag.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      this.error.set('Choose an existing tag, or add a new one on the Tags page.');
      return false;
    }
    this.tags.update((tags) =>
      tags.some((tag) => tag.toLowerCase() === existing.toLowerCase()) ? tags : [...tags, existing],
    );
    this.error.set(null);
    return true;
  }

  removeTag(name: string): void {
    this.tags.update((tags) => tags.filter((tag) => tag !== name));
  }
}
