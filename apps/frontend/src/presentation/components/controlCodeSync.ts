import type { ControlDescriptor, ControlTargetParam } from '@sythm/core';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatControlNumericValue(value: number, step: number): string {
  if (step >= 1) {
    return String(Math.round(value));
  }
  return String(Number(value.toFixed(2)));
}

function getInlinePrefixPattern(param: ControlTargetParam | undefined): string {
  switch (param) {
    case 'filterQ':
      return '\\bQ\\b(?:\\s+(?:IS|TO))?\\s+';
    case 'delayTimeSec':
      return '\\bTIME\\b(?:\\s+(?:IS|TO))?\\s+';
    case 'delayFeedback':
      return '\\bFEEDBACK\\b(?:\\s+(?:IS|TO))?\\s+';
    default:
      return '';
  }
}

/**
 * Surgically updates the numeric default inside a CONTROL or inline SLIDER line
 * without altering whitespace, comments, or sibling parameters on the same line.
 */
export function updateControlValueInCode(
  code: string,
  control: ControlDescriptor,
  newValue: number,
): string {
  const lines = code.split('\n');
  const lineIndex = control.declarationLine - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return code;
  }

  const line = lines[lineIndex];
  const formatted = formatControlNumericValue(newValue, control.step);
  let updatedLine = line;

  if (control.kind === 'declared') {
    const escapedName = escapeRegExp(control.name);
    const directRegex = new RegExp(
      `^(\\s*(?:DEFINE\\s+(?:(?:CONTROL|SLIDER)\\s+)?)?(?:CONTROL|SLIDER)\\s+["']?${escapedName}["']?\\s+(?:(?:IS|TO)\\s+)?(?:SLIDER\\s+)?)(-?\\d+(?:\\.\\d+)?)`,
      'i',
    );
    const defaultRegex = /(\bDEFAULT\s+(?:(?:IS|TO)\s+)?)(-?\d+(?:\.\d+)?)/i;
    const fromToInsertRegex = /(\bFROM\s+-?\d+(?:\.\d+)?\s+TO\s+-?\d+(?:\.\d+)?)/i;

    if (directRegex.test(line)) {
      updatedLine = line.replace(directRegex, `$1${formatted}`);
    } else if (defaultRegex.test(line)) {
      updatedLine = line.replace(defaultRegex, `$1${formatted}`);
    } else if (fromToInsertRegex.test(line)) {
      updatedLine = line.replace(fromToInsertRegex, `$1 DEFAULT ${formatted}`);
    }
  } else {
    const prefix = getInlinePrefixPattern(control.bindings[0]?.param);
    const sliderDirectRegex = new RegExp(
      `(${prefix}\\bSLIDER\\s+)(-?\\d+(?:\\.\\d+)?)`,
      'i',
    );
    const sliderDefaultRegex = new RegExp(
      `(${prefix}\\bSLIDER\\b(?:(?!\\bSLIDER\\b)[^.])*?\\bDEFAULT\\s+(?:(?:IS|TO)\\s+)?)(-?\\d+(?:\\.\\d+)?)`,
      'i',
    );
    const sliderFromToInsertRegex = new RegExp(
      `(${prefix}\\bSLIDER\\s+FROM\\s+-?\\d+(?:\\.\\d+)?\\s+TO\\s+-?\\d+(?:\\.\\d+)?)`,
      'i',
    );

    if (sliderDirectRegex.test(line)) {
      updatedLine = line.replace(sliderDirectRegex, `$1${formatted}`);
    } else if (sliderDefaultRegex.test(line)) {
      updatedLine = line.replace(sliderDefaultRegex, `$1${formatted}`);
    } else if (sliderFromToInsertRegex.test(line)) {
      updatedLine = line.replace(sliderFromToInsertRegex, `$1 DEFAULT ${formatted}`);
    }
  }

  if (updatedLine === line) {
    return code;
  }

  lines[lineIndex] = updatedLine;
  return lines.join('\n');
}
