// The sheet a long press on a saved look opens (the web's 'This look', look-manager.tsx and
// look-manage-forms.tsx at the pin): Rename (a field, 1 to 40 characters on one line), Duplicate
// and Delete, which asks once more ('Delete My look 1? This can't be undone.'). A preset never
// opens it. A refusal is said in the sheet, under the field; a rename, a duplicate or a delete
// closes the sheet and says what happened in the app's toast. The sheet keeps the look on screen
// while it slides away. HUD's Looks drawer (US-018c) opens the same sheet with its own words and
// no Duplicate (the drawing's RENAME / DELETE); Play's words are the default.

import { useState, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { LOOK_TEXT_MAX } from '../../../core/web/lib/look-kit/validate';
import { DEFAULT_LOOK } from '../../../core/web/lib/looks/presets';
import { Button, Sheet, Text, TextField, useToast } from '../../../ui';
import { PLAY_LOOK_COPY } from '../../strings';
import { useTokens } from '../../theme';
import { refusalCopy, type PlayLooksRefusal } from '../look-page';

type Mode = 'menu' | 'rename' | 'delete';

const TITLE_LEVEL = 4;
const SUB_LEVEL = 4;

/** A look the sheet can hold: Play's or HUD's. */
export type SheetLook = { readonly id: string; readonly name: string; readonly sub: string };

/** What a rename, duplicate or delete answers (Play's and HUD's changes are both this shape). */
export type SheetChange =
  | {
      readonly ok: true;
      readonly looks: { readonly saved: readonly SheetLook[]; readonly active: SheetLook };
    }
  | { readonly ok: false; readonly reason: PlayLooksRefusal };

export type LookSheetActions = {
  readonly activeId: string;
  readonly rename: (id: string, name: string) => SheetChange;
  /** Play's Duplicate; without it the sheet offers Rename and Delete only. */
  readonly duplicate?: (id: string) => SheetChange;
  readonly remove: (id: string) => SheetChange;
};

/** What the sheet says. */
export type LookSheetCopy = {
  readonly sheet: typeof PLAY_LOOK_COPY.sheet;
  readonly renamed: (name: string) => string;
  readonly duplicated: (name: string) => string;
  readonly deleted: (name: string, backTo: string | null) => string;
  readonly refusal: (reason: PlayLooksRefusal) => string;
  /** The look the style is back on after its active look is deleted. */
  readonly backTo: string;
};

export const PLAY_SHEET_COPY: LookSheetCopy = Object.freeze({
  sheet: PLAY_LOOK_COPY.sheet,
  renamed: PLAY_LOOK_COPY.renamed,
  duplicated: PLAY_LOOK_COPY.duplicated,
  deleted: PLAY_LOOK_COPY.deleted,
  refusal: refusalCopy,
  backTo: DEFAULT_LOOK.name,
});

type PartProps = {
  readonly look: SheetLook;
  readonly actions: LookSheetActions;
  readonly copy: LookSheetCopy;
  readonly onMode: (mode: Mode) => void;
  readonly onDone: (message: string) => void;
};

function Menu({ look, actions, copy, onMode, onDone }: PartProps) {
  const said = copy.sheet;
  const { duplicate } = actions;
  const onDuplicate = () => {
    const change = duplicate?.(look.id);
    if (change?.ok) onDone(copy.duplicated(change.looks.active.name));
  };
  return (
    <>
      <Button label={said.rename} variant="outline" fullWidth onPress={() => onMode('rename')} />
      {duplicate === undefined ? null : (
        <Button label={said.duplicate} variant="outline" fullWidth onPress={onDuplicate} />
      )}
      <Button label={said.delete} variant="outline" fullWidth onPress={() => onMode('delete')} />
    </>
  );
}

function RenameForm({ look, actions, copy, onMode, onDone }: PartProps) {
  const { spacing } = useTokens();
  const said = copy.sheet;
  const [name, setName] = useState(look.name);
  const [error, setError] = useState<string | undefined>(undefined);
  const save = () => {
    const change = actions.rename(look.id, name);
    if (!change.ok) return setError(copy.refusal(change.reason));
    const renamed = change.looks.saved.find((entry) => entry.id === look.id);
    onDone(copy.renamed(renamed?.name ?? name.trim()));
  };
  return (
    <>
      <TextField
        label={said.newName}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError(undefined);
        }}
        maxLength={LOOK_TEXT_MAX}
        autoFocus
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={save}
        error={error}
      />
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button label={said.cancel} variant="outline" onPress={() => onMode('menu')} />
        <Button label={said.saveName} onPress={save} />
      </View>
    </>
  );
}

function DeleteConfirm({ look, actions, copy, onMode, onDone }: PartProps) {
  const { spacing } = useTokens();
  const said = copy.sheet;
  const remove = () => {
    const wasOn = look.id === actions.activeId;
    const change = actions.remove(look.id);
    if (change.ok) onDone(copy.deleted(look.name, wasOn ? copy.backTo : null));
  };
  return (
    <>
      <Text accessibilityRole="alert">{said.confirmDelete(look.name)}</Text>
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button label={said.keep} variant="outline" onPress={() => onMode('menu')} />
        <Button label={said.deleteLook} onPress={remove} />
      </View>
    </>
  );
}

const PARTS: Readonly<Record<Mode, (props: PartProps) => ReactElement>> = Object.freeze({
  menu: Menu,
  rename: RenameForm,
  delete: DeleteConfirm,
});

export type LookSheetProps = {
  /** The saved look held; null while the sheet is closed. */
  readonly look: SheetLook | null;
  readonly onClose: () => void;
  readonly actions: LookSheetActions;
  /** Play's words when omitted. */
  readonly copy?: LookSheetCopy;
};

export function LookSheet({ look, onClose, actions, copy = PLAY_SHEET_COPY }: LookSheetProps) {
  const toast = useToast();
  const [held, setHeld] = useState<SheetLook | null>(look);
  const [mode, setMode] = useState<Mode>('menu');
  const [wasOpen, setWasOpen] = useState(false);
  const open = look !== null;
  // opening starts at the menu; a renamed look stays held under its new name
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMode('menu');
  }
  if (look !== null && look !== held) setHeld(look);
  if (held === null) return null;
  const Part = PARTS[mode];
  const done = (message: string) => {
    toast.show(message);
    onClose();
  };
  return (
    <Sheet visible={open} onClose={onClose}>
      <View>
        <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
          {held.name}
        </Text>
        {held.sub === '' ? null : (
          <Text level={SUB_LEVEL} tone="muted">
            {held.sub}
          </Text>
        )}
      </View>
      <Part
        key={`${held.id}:${mode}`}
        look={held}
        actions={actions}
        copy={copy}
        onMode={setMode}
        onDone={done}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
