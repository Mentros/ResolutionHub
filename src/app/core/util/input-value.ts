export function readInputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
}
