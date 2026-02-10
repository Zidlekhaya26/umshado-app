import React from 'react';

interface Props {
  verified?: boolean | null;
  className?: string;
}

export default function VerifiedBadge({ verified, className = '' }: Props) {
  if (!verified) return null;
  return (
    <span
      className={"inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200 " +
        className}
    >
      <svg className="w-3 h-3 text-blue-700" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Verified</span>
    </span>
  );
}
