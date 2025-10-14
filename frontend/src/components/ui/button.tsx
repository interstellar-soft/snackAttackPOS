import { cn } from '../../lib/utils';
import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'default' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-500',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ghost:
    'border border-transparent bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800'
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-sm'
};

export function Button({
  className,
  variant = 'primary',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium shadow transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
