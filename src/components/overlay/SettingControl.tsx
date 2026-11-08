'use client';

import type { Control } from '@/lib/overlay/sections';
import { getPath, unitLabel, type Settings } from '@/lib/overlay/settings';
import { ColorField, Select, Slider, TextField, Toggle } from '@/components/ui/controls';
import { StylePicker } from './StylePicker';

interface Props {
  control: Control;
  label: string;
  settings: Settings;
  onChange: (path: string, value: unknown) => void;
  onBadge: (kind: string) => void;
  onStyle: (style: 'card' | 'slim' | 'hud') => void;
}

/** Draws one option from sections.ts, bound to its setting. */
export function SettingControl({ control, label, settings, onChange, onBadge, onStyle }: Props) {
  switch (control.kind) {
    case 'style':
      return <StylePicker settings={settings} onPick={onStyle} />;
    case 'toggle':
      return <Toggle label={label} checked={Boolean(getPath(settings, control.path))} onChange={v => onChange(control.path, v)} />;
    case 'slider':
      return (
        <Slider
          label={label}
          value={Number(getPath(settings, control.path))}
          min={control.min}
          max={control.max}
          step={control.step}
          unit={unitLabel(settings, control.unit)}
          onChange={v => onChange(control.path, v)}
        />
      );
    case 'color':
      return <ColorField label={label} value={String(getPath(settings, control.path))} onChange={v => onChange(control.path, v)} />;
    case 'select':
      return <Select label={label} value={String(getPath(settings, control.path))} options={control.options} onChange={v => onChange(control.path, v)} />;
    case 'text':
      return <TextField label={label} placeholder={control.placeholder} value={String(getPath(settings, control.path))} onChange={v => onChange(control.path, v)} />;
    case 'badge':
      // Off, or which badge (Automatic follows the number).
      return <Select label={label} value={settings.plus.rankBadge ? settings.plus.rankBadgeKind : 'off'} options={control.options} onChange={onBadge} />;
  }
}
