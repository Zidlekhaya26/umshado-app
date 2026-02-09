import * as React from 'react';

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export default function Chip({ selected, className, ...props }: ChipProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        selected
          ? 'border-[var(--primary)] bg-[var(--secondary)] text-[var(--primary)]'
          : 'border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--primary)]'
      } ${className || ''}`}
      {...props}
    />
  );
}
