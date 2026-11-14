import type { CSSProperties } from 'react';
import { useId } from 'react';
import type { ControlDescriptor, ControlTargetParam } from '@sythm/core';

interface ControlSliderProps {
  control: ControlDescriptor;
  value: number;
  compact?: boolean;
  displayLabel?: string;
  onChange: (control: ControlDescriptor, newValue: number) => void;
}

const PARAM_ACCENT_COLOR: Record<ControlTargetParam, string> = {
  volume: '#0a84ff',
  tempo: '#ff9f0a',
  filterFrequencyHz: '#b281eb',
  filterQ: '#b281eb',
  delayMix: '#64d2ff',
  delayTimeSec: '#64d2ff',
  delayFeedback: '#64d2ff',
  reverbMix: '#30d158',
  detuneCents: '#ffd60a',
  pan: '#ff6482',
};

function formatControlValue(value: number, step: number, unit: string): string {
  const formatted =
    step >= 1
      ? String(Math.round(value))
      : String(Number(value.toFixed(2)));
  return unit ? `${formatted}${unit === '%' ? '%' : ` ${unit}`}` : formatted;
}

export function ControlSlider({
  control,
  value,
  compact = false,
  displayLabel,
  onChange,
}: ControlSliderProps) {
  const inputId = useId();
  const primaryParam = control.bindings[0]?.param;
  const accentColor = primaryParam ? PARAM_ACCENT_COLOR[primaryParam] : '#0a84ff';
  const formattedValue = formatControlValue(value, control.step, control.unit);
  const labelText = displayLabel ?? control.label;

  const sliderStyle = {
    '--attr-min': control.min,
    '--attr-max': control.max,
    '--control-value': value,
    '--slider-fill-color': accentColor,
  } as CSSProperties;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border border-[#4a4d55] bg-[#1e1f24]/95 px-2 ${
        compact ? 'h-5' : 'h-[22px]'
      }`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <label
        htmlFor={inputId}
        className="shrink-0 cursor-pointer font-mono-code text-[10px] font-semibold tracking-tight text-[#d1d1d6]"
        title={`${control.name} (${control.min}..${control.max}${control.unit ? ` ${control.unit}` : ''})`}
      >
        {labelText}
      </label>

      <div className={compact ? 'w-16 shrink-0' : 'w-24 shrink-0'}>
        <input
          id={inputId}
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          style={sliderStyle}
          aria-label={`Controle ${labelText}`}
          aria-valuetext={formattedValue}
          onChange={(e) => onChange(control, Number.parseFloat(e.target.value))}
          className="sythm-slider"
        />
      </div>

      <span className="min-w-[2.6rem] shrink-0 text-right font-mono-code text-[10px] font-semibold text-[#f2f2f7] tabular-nums">
        {formattedValue}
      </span>
    </div>
  );
}
