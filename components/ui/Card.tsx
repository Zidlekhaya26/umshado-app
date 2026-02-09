import * as React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

type CardSectionProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={`rounded-3xl bg-[var(--card)] shadow-[var(--shadow)] border border-[var(--border)] ${
        className || ''
      }`}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardSectionProps) {
  return <div className={`px-6 pt-6 ${className || ''}`} {...props} />;
}

export function CardContent({ className, ...props }: CardSectionProps) {
  return <div className={`px-6 pb-6 ${className || ''}`} {...props} />;
}
