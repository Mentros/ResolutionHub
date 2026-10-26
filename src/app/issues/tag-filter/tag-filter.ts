import { Component, Input, Signal, WritableSignal, computed, signal } from '@angular/core';
import { CrsdBtn } from '@mentros/crsd-ui';

/** Chip rows before the filter panel scrolls (~2 rows of chips). */
const SCROLL_MAX_HEIGHT = '5.75rem';
const EXPAND_THRESHOLD = 7;

@Component({
  selector: 'app-tag-filter',
  imports: [CrsdBtn],
  templateUrl: './tag-filter.html',
  styles: ':host { display: block; }',
})
export class TagFilter {
  @Input({ required: true }) tags!: Signal<string[]>;
  @Input({ required: true }) selected!: WritableSignal<string[]>;
  @Input() groupLabel = 'Nach Bezeichnung filtern';

  readonly expanded = signal(false);

  readonly showExpandToggle = computed(() => this.tags().length > EXPAND_THRESHOLD);

  readonly scrollMaxHeight = SCROLL_MAX_HEIGHT;

  isSelected(tag: string): boolean {
    return this.selected().some((name) => name.toLowerCase() === tag.toLowerCase());
  }

  toggle(tag: string): void {
    this.selected.update((current) => {
      const active = current.some((name) => name.toLowerCase() === tag.toLowerCase());
      return active
        ? current.filter((name) => name.toLowerCase() !== tag.toLowerCase())
        : [...current, tag];
    });
  }

  clearSelected(): void {
    this.selected.set([]);
  }

  selectedCount(): number {
    return this.selected().length;
  }
}
