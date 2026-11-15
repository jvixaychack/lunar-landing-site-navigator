import type { KeyboardEvent } from 'react';

interface DatePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className: string;
}

const pickerKeys = new Set(['Tab', 'Escape', 'Enter', ' ']);

function preventDateTyping(event: KeyboardEvent<HTMLInputElement>) {
  if (pickerKeys.has(event.key) || (event.altKey && event.key === 'ArrowDown')) return;
  event.preventDefault();
}

export function DatePickerInput({
  value,
  onChange,
  ariaLabel,
  className,
}: DatePickerInputProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={preventDateTyping}
      onPaste={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
