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
export const pageHead = 'flex flex-col gap-2';
export const pageTitle = 'text-3xl font-semibold tracking-tight';
export const pageLede = 'max-w-2xl text-muted-foreground';
export const backLink = 'text-sm text-primary hover:underline no-underline';
