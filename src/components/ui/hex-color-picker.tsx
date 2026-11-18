'use client';

// A color picker that works in hex everywhere: the browser's own picker shows RGB numbers on Windows, with no way
// to switch it to hex from the page.
import * as React from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  /** #rrggbb */
  value: string;
  onChange: (hex: string) => void;
  /** The button that opens the picker. */
  children: React.ReactNode;
  disabled?: boolean;
}

export function HexColorPopover({ value, onChange, children, disabled }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-3" align="start">
        <HexColorPicker color={value} onChange={onChange} className="hex-picker" />
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Hex</span>
          <HexColorInput
            color={value}
            onChange={onChange}
            prefixed
            spellCheck={false}
            aria-label="Hex color"
            className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-md border px-2 font-mono text-sm uppercase outline-none focus-visible:ring-3"
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}
