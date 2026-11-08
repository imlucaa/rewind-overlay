'use client';

import { useId, useState, type ReactNode } from 'react';

// The form controls of the original settings page, styled by site.css.

interface RowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Row({ label, hint, children }: RowProps) {
  return (
    <div className="row">
      <div className="label">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
      {children}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return <input type="checkbox" className="switch" aria-label={label} checked={checked} onChange={e => onChange(e.target.checked)} />;
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  label: string;
  onChange: (value: number) => void;
}

export function Slider({ value, min, max, step, unit, label, onChange }: SliderProps) {
  return (
    <div className="slider">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      <output>
        {value}
        {unit}
      </output>
    </div>
  );
}

interface ColorProps {
  value: string;
  label: string;
  onChange: (value: string) => void;
}

/** A picker and a text box; the text box only commits a full #rrggbb. */
export function ColorField({ value, label, onChange }: ColorProps) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    // The value changed from outside (picker, reset): show it.
    setShown(value);
    setDraft(value);
  }
  return (
    <div className="color">
      <input type="color" aria-label={label} value={value} onChange={e => onChange(e.target.value)} />
      <input
        type="text"
        aria-label={`${label} hex`}
        placeholder="#rrggbb"
        value={draft}
        onChange={e => {
          setDraft(e.target.value);
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value);
        }}
      />
    </div>
  );
}

interface SelectProps<T extends string> {
  value: T;
  options: readonly (readonly [T, string])[];
  label: string;
  onChange: (value: T) => void;
}

export function Select<T extends string>({ value, options, label, onChange }: SelectProps<T>) {
  const id = useId();
  return (
    <select id={id} aria-label={label} value={value} onChange={e => onChange(e.target.value as T)}>
      {options.map(([v, text]) => (
        <option key={v} value={v}>
          {text}
        </option>
      ))}
    </select>
  );
}

interface TextProps {
  value: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
}

export function TextField({ value, placeholder, label, onChange }: TextProps) {
  return <input type="text" aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />;
}
