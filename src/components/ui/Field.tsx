"use client";

import { cn } from "@/lib/cn";

const inputClasses =
  "w-full rounded-xl border border-sand bg-white px-4 py-3 text-sm text-ink-900 placeholder:text-muted/70 transition-colors focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20";

export function FieldLabel({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink-900">
      {children}
      {optional && <span className="text-xs font-normal text-muted">Optional</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs font-medium text-crimson">{children}</p>;
}

export function TextInput({
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return <input id={id} className={cn(inputClasses, className)} {...props} />;
}

export function TextArea({
  id,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string }) {
  return <textarea id={id} className={cn(inputClasses, "min-h-32 resize-y", className)} {...props} />;
}

export function RadioCardGroup<T extends string>({
  name,
  options,
  value,
  onChange,
  columns = 2,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
}) {
  const colClass = columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return (
    <div className={cn("grid grid-cols-1 gap-3", colClass)} role="radiogroup">
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
              checked
                ? "border-orange bg-orange/5 text-ink-900"
                : "border-sand bg-white text-ink-900/80 hover:border-ink-950/20",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                checked ? "border-orange" : "border-sand",
              )}
            >
              {checked && <span className="size-2 rounded-full bg-orange" />}
            </span>
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

export function CheckboxField({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-ink-900/80">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-sand text-crimson focus:ring-2 focus:ring-crimson/30"
      />
      {children}
    </label>
  );
}
