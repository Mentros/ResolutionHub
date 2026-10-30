export const BASIC_LANGUAGE_TAG = 'BASIC';

export interface TagProgramGroup {
  parent: string;
  programs: string[];
}

export interface TagProgramsResponse {
  groups: TagProgramGroup[];
}

export const TAG_PROGRAMS_URL = '/api/tags/programs';

export function programNamesFromGroups(groups: TagProgramGroup[]): Set<string> {
  const names = new Set<string>();
  for (const group of groups) {
    for (const program of group.programs) {
      names.add(program.toLowerCase());
    }
  }
  return names;
}

export function programsForParent(groups: TagProgramGroup[], parent: string): string[] {
  const key = parent.toLowerCase();
  return groups.find((group) => group.parent.toLowerCase() === key)?.programs ?? [];
}

export function splitSelectedTags(
  selected: string[],
  programNames: Set<string>,
): { general: string[]; programs: string[] } {
  const general: string[] = [];
  const programs: string[] = [];
  for (const name of selected) {
    if (programNames.has(name.toLowerCase())) {
      programs.push(name);
    } else {
      general.push(name);
    }
  }
  return { general, programs };
}

export function mergeSelectedTags(general: string[], programs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...general, ...programs]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function isBasicSelected(general: string[]): boolean {
  return general.some((name) => name.toLowerCase() === BASIC_LANGUAGE_TAG.toLowerCase());
}

export function parentForProgram(groups: TagProgramGroup[], program: string): string | null {
  const key = program.toLowerCase();
  for (const group of groups) {
    if (group.programs.some((name) => name.toLowerCase() === key)) {
      return group.parent;
    }
  }
  return null;
}

/** Tag names for the main Bezeichnung filter (exclude nested program codes). */
export function filterGeneralTagCatalog(allTags: string[], programNames: Set<string>): string[] {
  return allTags.filter((name) => !programNames.has(name.toLowerCase()));
}

/** Chips on cards: hide program codes when the parent language tag is already shown. */
export function tagsForDisplayChips(tags: string[], groups: TagProgramGroup[]): string[] {
  if (groups.length === 0) return tags;
  const programToParent = new Map<string, string>();
  for (const group of groups) {
    for (const program of group.programs) {
      programToParent.set(program.toLowerCase(), group.parent);
    }
  }
  const present = new Set(tags.map((t) => t.toLowerCase()));
  return tags.filter((name) => {
    const parent = programToParent.get(name.toLowerCase());
    if (!parent) return true;
    return !present.has(parent.toLowerCase());
  });
}
