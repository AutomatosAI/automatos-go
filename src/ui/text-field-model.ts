// TextField's logic, pure: whether the person can type in the field. React Native reads readOnly
// before editable (TextInput.js: readOnly !== undefined ? !readOnly : editable), and the field adds
// its own disabled on top. The same answer sets the input's editable and decides whether a touch in
// the field's slop focuses it (rules 3.2, 10.1): a field that cannot be edited is never focused by
// a touch just outside it, as a touch on it does not open the keyboard either.

export type FieldEditing = Readonly<{
  disabled: boolean;
  readOnly?: boolean;
  editable?: boolean;
}>;

/** True when the field takes typing: not disabled, and neither read-only nor made uneditable. */
export function fieldEditable({ disabled, readOnly, editable }: FieldEditing): boolean {
  const asked = readOnly !== undefined ? !readOnly : editable !== false;
  return !disabled && asked;
}
