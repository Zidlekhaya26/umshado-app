import * as React from 'react';

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
};

export default function SectionTitle({ title, subtitle, align = 'left' }: SectionTitleProps) {
  return (
    <div className={align === 'center' ? 'text-center' : 'text-left'}>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      )}
    </div>
  );
}
