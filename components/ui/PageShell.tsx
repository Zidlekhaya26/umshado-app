import * as React from 'react';

type PageShellProps = React.HTMLAttributes<HTMLDivElement> & {
  maxWidth?: string;
};

export default function PageShell({ className, maxWidth = 'max-w-md', ...props }: PageShellProps) {
  return (
    <div className={`min-h-screen bg-[var(--bg)] px-4 py-8 ${className || ''}`}>
      <div className={`mx-auto w-full ${maxWidth}`} {...props} />
    </div>
  );
}
