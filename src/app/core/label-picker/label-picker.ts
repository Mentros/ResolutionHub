import { Component, Input, Signal, WritableSignal, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RemovableLabelChips } from '../label-chips/removable-label-chips';
import {
  CrsdAlert,
  CrsdAlertDescription,
  CrsdField,
  CrsdFieldDescription,
  CrsdIcon,
  CrsdLabel,
  CrsdSelect,
  CrsdSelectContent,
  CrsdSelectPlaceholder,
  CrsdSelectPortal,
  CrsdSelectTrigger,
  type CrsdOption,
} from '@mentros/crsd-ui';

@Component({
  selector: 'app-label-picker',
  imports: [
    RouterLink,
    CrsdField,
    CrsdLabel,
    RemovableLabelChips,
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
  templateUrl: './label-picker.html',
  styles: ':host { display: contents; }',
})
export class LabelPicker {
  @Input({ required: true }) fieldLabel!: string;
  @Input({ required: true }) inputId!: string;
  @Input({ required: true }) selected!: WritableSignal<string[]>;
  @Input({ required: true }) catalog!: Signal<string[]>;
  @Input() unknownMessage = 'Wähle einen vorhandenen Namen oder lege einen neuen auf der Seite Bezeichnungen an.';
  @Input() manageHref = '/tags';

  readonly pickerValue = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly pickableOptions = computed((): CrsdOption[] => {
    const chosen = new Set(this.selected().map((name) => name.toLowerCase()));
    return this.catalog()
      .filter((name) => !chosen.has(name.toLowerCase()))
      .map((name) => ({ value: name, label: name }));
  });

  commitDraft(): boolean {
    return true;
  }

  onPick(value: string | null): void {
    this.pickerValue.set(value);
    if (!value) return;
    if (this.addName(value)) {
      this.pickerValue.set(null);
    }
  }

  addName(name: string): boolean {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      return true;
    }
    if (trimmed.includes(',')) {
      this.error.set('Namen dürfen keine Kommas enthalten.');
      return false;
    }
    if (trimmed.length > 40) {
      this.error.set('Namen dürfen höchstens 40 Zeichen lang sein.');
      return false;
    }
    const existing = this.catalog().find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      this.error.set(this.unknownMessage);
      return false;
    }
    this.selected.update((names) =>
      names.some((entry) => entry.toLowerCase() === existing.toLowerCase())
        ? names
        : [...names, existing],
    );
    this.error.set(null);
    return true;
  }

  removeName(name: string): void {
    this.selected.update((names) => names.filter((entry) => entry !== name));
  }
}
