// The sheet a long press on a saved look opens (the web's 'This look', look-manager.tsx and
// look-manage-forms.tsx at the pin): Rename (a field, 1 to 40 characters on one line), Duplicate
// and Delete, which asks once more ('Delete My look 1? This can't be undone.'). A preset never
// opens it. A refusal is said in the sheet, under the field; a rename, a duplicate or a delete
// closes the sheet and says what happened in the app's toast. The sheet keeps the look on screen
// while it slides away.

import { useState, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { LOOK_TEXT_MAX } from '../../../core/web/lib/look-kit/validate';
import { DEFAULT_LOOK } from '../../../core/web/lib/looks/presets';
import type { Look } from '../../../core/web/lib/looks/types';
import { Button, Sheet, Text, TextField, useToast } from '../../../ui';
import { PLAY_LOOK_COPY } from '../../strings';
import { useTokens } from '../../theme';
import { refusalCopy } from '../look-page';
import type { LookPage } from './use-look-page';

type Mode = 'menu' | 'rename' | 'delete';

const TITLE_LEVEL = 4;
const SUB_LEVEL = 4;
const said = PLAY_LOOK_COPY.sheet;

type Actions = Pick<LookPage, 'rename' | 'duplicate' | 'remove'> & {
  readonly activeId: string;
};

type PartProps = {
  readonly look: Look;
  readonly actions: Actions;
  readonly onMode: (mode: Mode) => void;
  readonly onDone: (message: string) => void;
};

function Menu({ look, actions, onMode, onDone }: PartProps) {
  const duplicate = () => {
    const change = actions.duplicate(look.id);
    if (change.ok) onDone(PLAY_LOOK_COPY.duplicated(change.looks.active.name));
  };
  return (
    <>
      <Button label={said.rename} variant="outline" fullWidth onPress={() => onMode('rename')} />
      <Button label={said.duplicate} variant="outline" fullWidth onPress={duplicate} />
      <Button label={said.delete} variant="outline" fullWidth onPress={() => onMode('delete')} />
    </>
  );
}

function RenameForm({ look, actions, onMode, onDone }: PartProps) {
  const { spacing } = useTokens();
  const [name, setName] = useState(look.name);
  const [error, setError] = useState<string | undefined>(undefined);
  const save = () => {
    const change = actions.rename(look.id, name);
    if (!change.ok) return setError(refusalCopy(change.reason));
    const renamed = change.looks.saved.find((entry) => entry.id === look.id);
    onDone(PLAY_LOOK_COPY.renamed(renamed?.name ?? name.trim()));
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

function DeleteConfirm({ look, actions, onMode, onDone }: PartProps) {
  const { spacing } = useTokens();
  const remove = () => {
    const wasOn = look.id === actions.activeId;
    const change = actions.remove(look.id);
    if (change.ok) onDone(PLAY_LOOK_COPY.deleted(look.name, wasOn ? DEFAULT_LOOK.name : null));
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
  readonly look: Look | null;
  readonly onClose: () => void;
  readonly actions: Actions;
};

export function LookSheet({ look, onClose, actions }: LookSheetProps) {
  const toast = useToast();
  const [held, setHeld] = useState<Look | null>(look);
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
        <Text level={SUB_LEVEL} tone="muted">
          {held.sub}
        </Text>
      </View>
      <Part
        key={`${held.id}:${mode}`}
        look={held}
        actions={actions}
        onMode={setMode}
        onDone={done}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
