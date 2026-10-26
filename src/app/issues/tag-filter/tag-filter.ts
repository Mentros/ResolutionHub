import { Component, Input, Signal, WritableSignal, computed, input, signal } from '@angular/core';
import { CrsdBtn, CrsdIcon, CrsdInput } from '@mentros/crsd-ui';

/** Chip rows before the filter panel scrolls (~2 rows of chips). */
const SCROLL_MAX_HEIGHT = '5.75rem';
const EXPAND_THRESHOLD = 7;
const CHIP_QUERY_THRESHOLD = 5;

@Component({
  selector: 'app-tag-filter',
  imports: [CrsdBtn, CrsdIcon, CrsdInput],
  templateUrl: './tag-filter.html',
  styles: ':host { display: block; }',
})
export class TagFilter {
  @Input({ required: true }) tags!: Signal<string[]>;
  @Input({ required: true }) selected!: WritableSignal<string[]>;
  @Input() groupLabel = 'Nach Bezeichnung filtern';

  readonly embedded = input(false);

  readonly chipQuery = signal('');

  readonly expanded = signal(false);

  readonly showChipQuery = computed(() => this.tags().length >= CHIP_QUERY_THRESHOLD);

  readonly showExpandToggle = computed(() => this.visibleTags().length > EXPAND_THRESHOLD);

  readonly visibleTags = computed(() => {
    const tags = this.tags();
    const q = this.chipQuery().trim().toLowerCase();
    if (!q) {
      return tags;
    }
    const selectedLower = new Set(this.selected().map((name) => name.toLowerCase()));
    return tags.filter(
      (tag) => tag.toLowerCase().includes(q) || selectedLower.has(tag.toLowerCase()),
    );
  });

  readonly panelClass = computed(() =>
    this.embedded()
      ? 'flex flex-col gap-3 border-t border-border/70 pt-4'
      : 'flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 shadow-sm',
  );

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

  resetChipQuery(): void {
    this.chipQuery.set('');
  }

  selectedCount(): number {
    return this.selected().length;
  }
}
