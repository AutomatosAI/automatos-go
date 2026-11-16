// Whether the text field takes typing (text-field-model.ts): the answer sets the input's editable and
// decides whether a touch in the field's slop focuses it, so a field that cannot be edited is never
// focused from just outside it. React Native reads readOnly before editable; the field's disabled
// comes on top. Read from the pure decision and the field's source (no React renderer in vitest).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { fieldEditable } from '../text-field-model';

const SOURCE = readFileSync(path.resolve(__dirname, '../TextField.tsx'), 'utf8');

describe('whether the field takes typing', () => {
  it('does by default', () => {
    expect(fieldEditable({ disabled: false })).toBe(true);
    expect(fieldEditable({ disabled: false, editable: true, readOnly: false })).toBe(true);
  });

  it('does not when disabled, read-only or made uneditable', () => {
    expect(fieldEditable({ disabled: true })).toBe(false);
    expect(fieldEditable({ disabled: false, readOnly: true })).toBe(false);
    expect(fieldEditable({ disabled: false, editable: false })).toBe(false);
  });

  it('reads readOnly before editable, as React Native does', () => {
    expect(fieldEditable({ disabled: false, readOnly: false, editable: false })).toBe(true);
    expect(fieldEditable({ disabled: false, readOnly: true, editable: true })).toBe(false);
  });

  it('stays off while disabled, whatever readOnly says', () => {
    expect(fieldEditable({ disabled: true, readOnly: false })).toBe(false);
    expect(fieldEditable({ disabled: true, editable: true })).toBe(false);
  });
});

describe('the field', () => {
  it('decides once from disabled, readOnly and editable', () => {
    expect(SOURCE).toContain('const canEdit = fieldEditable({ disabled, readOnly, editable });');
  });

  it('gives the input that answer, and keeps readOnly and editable out of its spread', () => {
    expect(SOURCE).toContain('editable={canEdit}');
    expect(SOURCE).toMatch(
      /disabled = false,\s+readOnly,\s+editable,\s+onFocus,\s+onBlur,\s+\.\.\.input/,
    );
  });

  it('focuses from its slop only when it takes typing', () => {
    expect(SOURCE).toContain('const takesTouch = () => canEdit;');
    expect(SOURCE).toContain('onStartShouldSetResponder={takesTouch}');
  });
});
