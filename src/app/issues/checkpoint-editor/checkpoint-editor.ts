import { Component, Input, WritableSignal } from '@angular/core';
import {
  CrsdBtn,
  CrsdCard,
  CrsdField,
  CrsdFieldDescription,
  CrsdInput,
  CrsdLabel,
  CrsdTextarea,
} from '@mentros/crsd-ui';

export interface CheckpointDraft {
  key: number;
  instruction: string;
  wikiUrl: string;
  sharePath: string;
}

@Component({
  selector: 'app-checkpoint-editor',
  imports: [CrsdCard, CrsdField, CrsdFieldDescription, CrsdLabel, CrsdInput, CrsdTextarea, CrsdBtn],
  templateUrl: './checkpoint-editor.html',
  styles: ':host { display: contents; }',
})
export class CheckpointEditor {
  @Input({ required: true }) checkpoints!: WritableSignal<CheckpointDraft[]>;

  add(): void {
    this.checkpoints.update((rows) => [...rows, blankCheckpoint(rows)]);
  }

  remove(key: number): void {
    this.checkpoints.update((rows) => {
      const next = rows.filter((row) => row.key !== key);
      return next.length > 0 ? next : [blankCheckpoint(rows)];
    });
  }

  move(key: number, delta: number): void {
    this.checkpoints.update((rows) => {
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

  setField(key: number, field: 'instruction' | 'wikiUrl' | 'sharePath', value: string): void {
    this.checkpoints.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }
}

function blankCheckpoint(rows: CheckpointDraft[]): CheckpointDraft {
  const key = rows.reduce((max, row) => Math.max(max, row.key), 0) + 1;
  return { key, instruction: '', wikiUrl: '', sharePath: '' };
}
