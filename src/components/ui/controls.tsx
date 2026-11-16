'use client';

import { useId, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select as SelectRoot, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider as SliderRoot } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

// The settings form controls, on shadcn/ui. A Row puts a label (and an optional hint under it) beside its control.

interface RowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Row({ label, hint, children }: RowProps) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1 basis-48">
        <div className="text-[15px] font-medium">{label}</div>
        {hint ? <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** A group of Rows, in a bordered box. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="bg-card rounded-lg border px-4">{children}</div>;
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />;
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
    <div className="flex w-56 max-w-full items-center gap-3">
      <SliderRoot aria-label={label} min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
      <output className="text-muted-foreground w-14 shrink-0 text-right text-sm tabular-nums">
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

/** A swatch picker and a hex box; the box only commits a full #rrggbb. */
export function ColorField({ value, label, onChange }: ColorProps) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    // The value changed from outside (picker, reset): show it.
    setShown(value);
    setDraft(value);
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border-input size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
      />
      <Input
        aria-label={`${label} hex`}
        placeholder="#rrggbb"
        spellCheck={false}
        value={draft}
        className="w-24 font-mono text-xs"
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
  return (
    <SelectRoot value={value} onValueChange={v => onChange(v as T)}>
      <SelectTrigger aria-label={label} className="w-48 max-w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(([v, text]) => (
            <SelectItem key={v} value={v}>
              {text}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </SelectRoot>
  );
}

interface TextProps {
  value: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
}

export function TextField({ value, placeholder, label, onChange }: TextProps) {
  const id = useId();
  return (
    <>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Input id={id} placeholder={placeholder} value={value} className="w-56 max-w-full" onChange={e => onChange(e.target.value)} />
    </>
  );
}
