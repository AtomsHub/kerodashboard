'use client';

// src/components/ui/app-button.tsx
// Web counterpart of kero-mobile `AppButton` (packages/ui/src/components/actions/app-button.tsx).
// Wraps HeroUI v3 <Button> and adds: label, isLoading, startContent/endContent,
// a Kero "brand" (gold) variant, and a pill shape by default. Colours come only
// from semantic theme tokens, so light/dark are handled without `dark:` classes.
import { cloneElement, forwardRef, isValidElement, type ReactNode } from 'react';
import { Button, Spinner, type ButtonProps } from '@heroui/react';

type HeroVariant = NonNullable<ButtonProps['variant']>;

export type AppButtonProps = Omit<ButtonProps, 'variant' | 'children'> & {
  /** HeroUI variants plus Kero `brand` (gold, matches mobile `bg-secondary`). */
  variant?: HeroVariant | 'brand';
  label?: string;
  isLoading?: boolean;
  startContent?: ReactNode;
  endContent?: ReactNode;
  /** Pill (default, like mobile) or a softer rounded rectangle. */
  shape?: 'pill' | 'rounded';
  children?: ReactNode;
};

const ICON_SIZE = { sm: 16, md: 18, lg: 20 } as const;

/** Phosphor icons default to duotone and a size that matches the button size. */
function resolveIcon(content: ReactNode, size: number): ReactNode {
  if (!content || !isValidElement(content)) return content ?? null;
  const props = content.props as { size?: number; weight?: string };
  return cloneElement(content, {
    size: props.size ?? size,
    weight: props.weight ?? 'duotone',
    'aria-hidden': true,
  } as Record<string, unknown>);
}

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  {
    label,
    children,
    isLoading = false,
    isDisabled,
    startContent,
    endContent,
    variant = 'primary',
    size = 'md',
    shape = 'pill',
    isIconOnly,
    className,
    ...props
  },
  ref,
) {
  const isBrand = variant === 'brand';
  const iconSize = ICON_SIZE[size ?? 'md'];

  const classes = [
    'font-medium tracking-[-0.01em] gap-2',
    shape === 'pill' ? 'rounded-full' : 'rounded-xl',
    !isIconOnly && size === 'md' && 'h-10 px-5',
    !isIconOnly && size === 'lg' && 'h-12 px-6 text-[15px]',
    !isIconOnly && size === 'sm' && 'h-8 px-3.5 text-[13px]',
    isBrand && 'bg-secondary text-secondary-foreground hover:opacity-90',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Button
      {...props}
      ref={ref}
      variant={isBrand ? 'primary' : variant}
      size={size}
      isIconOnly={isIconOnly}
      isDisabled={isDisabled || isLoading}
      isPending={isLoading}
      className={classes}
    >
      {isLoading ? <Spinner size="sm" color="current" /> : resolveIcon(startContent, iconSize)}
      {children !== undefined ? children : label !== undefined ? <span>{label}</span> : null}
      {!isLoading && resolveIcon(endContent, iconSize)}
    </Button>
  );
});
