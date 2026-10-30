export async function writeClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', 'true');
    area.style.position = 'fixed';
    area.style.left = '0';
    area.style.top = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) {
      throw new Error('Kopieren fehlgeschlagen.');
    }
  }
}
