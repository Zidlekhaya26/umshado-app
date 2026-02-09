import * as React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-gray-400 shadow-[0_8px_20px_rgba(80,45,60,0.08)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)] ${
        className || ''
      }`}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-gray-400 shadow-[0_8px_20px_rgba(80,45,60,0.08)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)] ${
        className || ''
      }`}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';
