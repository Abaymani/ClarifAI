"use client";

import { useId } from "react";

export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex w-fit rounded-lg bg-muted p-1"
      >
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${option === value ? "bg-background shadow-xs" : "text-muted-foreground"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
