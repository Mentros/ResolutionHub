export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSharePath(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('\\\\') || trimmed.startsWith('//');
}

export function isValidWikiLocation(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isSharePath(trimmed)) return trimmed.length <= 500;
  return isHttpUrl(trimmed);
}
