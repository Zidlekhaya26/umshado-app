import * as React from 'react';

type PageShellProps = React.HTMLAttributes<HTMLDivElement> & {
  maxWidth?: string;
};

export default function PageShell({ className, maxWidth = 'mx-auto w-full max-w-md lg:max-w-6xl lg:px-6', ...props }: PageShellProps) {
  return (
    <div className={`min-h-screen bg-[var(--bg)] px-4 py-8 ${className || ''}`}>
      <div className={`mx-auto w-full ${maxWidth}`} {...props} />
    </div>
  );
}
