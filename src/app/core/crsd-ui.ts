import { BUTTON_BASE, BUTTON_SIZES, buttonClasses, cn } from '@mentros/crsd-ui';

export const btnPrimary = cn(BUTTON_BASE, buttonClasses('solid', 'primary'), BUTTON_SIZES.md);
export const btnOutline = cn(BUTTON_BASE, buttonClasses('outline', 'secondary'), BUTTON_SIZES.md);
export const btnGhost = cn(BUTTON_BASE, buttonClasses('ghost', 'secondary'), BUTTON_SIZES.sm);
export const btnLink = cn(BUTTON_BASE, buttonClasses('link', 'primary'), BUTTON_SIZES.md);
export const btnDestructive = cn(
  BUTTON_BASE,
  buttonClasses('outline', 'destructive'),
  BUTTON_SIZES.md,
);

export const pageSection = 'flex flex-col gap-4';
export const pageResults = 'mt-2 flex flex-col gap-4 border-t border-border pt-6';
export const pageHead = 'flex flex-col gap-2';
export const pageTitle = 'text-3xl font-semibold tracking-tight';
export const pageLede = 'max-w-2xl text-muted-foreground';
export const backLink = cn(
  'inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1.5 -ml-2.5',
  'text-sm font-medium text-muted-foreground no-underline',
  'transition-colors hover:bg-muted/70 hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
);
