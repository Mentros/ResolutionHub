import {
  programFilterLabel,
  programFilterRows,
  pruneProgramsForGeneral,
  selectedProgramParents,
} from './tag-programs';

describe('selectedProgramParents', () => {
  const groups = [
    { parent: 'BASIC', programs: ['SXY100'] },
    { parent: 'EF3', programs: ['EF3APP'] },
  ];

  it('returns selected parents in group order', () => {
    expect(selectedProgramParents(['EF3', 'Teams', 'BASIC'], groups)).toEqual(['BASIC', 'EF3']);
  });

  it('returns empty when no program parent is selected', () => {
    expect(selectedProgramParents(['Teams'], groups)).toEqual([]);
  });
});

describe('programFilterRows', () => {
  it('builds rows with programs per parent', () => {
    const rows = programFilterRows(['BASIC'], [{ parent: 'BASIC', programs: ['SXY100', 'ZV1000'] }]);
    expect(rows).toEqual([{ parent: 'BASIC', programs: ['SXY100', 'ZV1000'] }]);
  });
});

describe('pruneProgramsForGeneral', () => {
  const groups = [{ parent: 'BASIC', programs: ['SXY100', 'ZV1000'] }];

  it('keeps programs whose parent remains selected', () => {
    expect(pruneProgramsForGeneral(['BASIC'], ['SXY100'], groups)).toEqual(['SXY100']);
  });

  it('removes programs when parent is deselected', () => {
    expect(pruneProgramsForGeneral(['Teams'], ['SXY100'], groups)).toEqual([]);
  });
});

describe('programFilterLabel', () => {
  it('includes parent name', () => {
    expect(programFilterLabel('BASIC')).toBe('Programme (BASIC)');
  });
});
