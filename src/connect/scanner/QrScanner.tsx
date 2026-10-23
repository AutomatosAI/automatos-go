// The QR scanner (PRD-001 §4.5, US-006g): expo-camera's CameraView reading QR codes only. The
// camera permission is asked when the scanner opens, never at launch; refused, it says so with
// Open Settings and Type the code. The first valid pairing code is handed to the caller once and
// later frames are ignored; an invalid QR shows its copy and scanning goes on. The scanner never
// pairs and never calls the server: the caller opens Connect with the server and the code, which
// stops at the confirm card (KC8).
//
// KC13: this in-app scanner is the way to pair. app.json's associatedDomains name
// applinks:ui.automatos.app only, and pairing is self-hosted only (POST /pair is 404 on saas), so a
// self-hosted install's QR opened with the phone's own Camera goes to that server's /go/pair web
// page, never to this app. app/go/pair.tsx still handles automatos://go/pair and any link the OS
// hands over. Thin wiring: scan-state.ts decides what shows.

import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type BarcodeSettings,
} from 'expo-camera';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useEffect, useReducer, useRef, type Dispatch } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { StepNote } from '../../auth/screens/StepNote';
import { logger } from '../../lib/logger';
import { useTokens } from '../../styles/theme';
import { Button, IconButton, Screen, Text } from '../../ui';
import type { PairLink } from '../pair-link';
import { SCAN_COPY } from '../strings';
import {
  INITIAL_SCAN,
  cameraPermissionOf,
  scanReducer,
  scannerView,
  shouldAskForCamera,
  type CameraPermission,
  type ScanAction,
  type ScannerView,
} from './scan-state';

/** QR codes only: Studio's pairing code is one, and nothing else is read. */
const QR_ONLY = Object.freeze<BarcodeSettings>({ barcodeTypes: ['qr'] });
const TITLE_LEVEL = 2;
const MESSAGE_LEVEL = 2;

export type QrScannerProps = {
  /** The first valid pairing code, once. The caller opens Connect with it; nothing pairs here. */
  readonly onPairLink: (link: PairLink) => void;
  readonly onTypeCode: () => void;
  readonly onBack: () => void;
};

/** expo-camera's requestPermission. */
type AskPermission = ReturnType<typeof useCameraPermissions>[1];

/** Asks for the camera once, when the scanner opens; a failed ask is a camera that can't start. */
function useAskOnOpen(
  permission: CameraPermission,
  asked: boolean,
  ask: AskPermission,
  dispatch: Dispatch<ScanAction>,
): void {
  useEffect(() => {
    if (!shouldAskForCamera(permission, asked)) return;
    dispatch({ type: 'asked' });
    ask().catch((error: unknown) => {
      logger.warn('[connect] the camera permission could not be asked for', error);
      dispatch({ type: 'cameraFailed' });
    });
  }, [permission, asked, ask, dispatch]);
}

/** Hands the first valid code over exactly once (React's second effect run included). */
function useHandOver(found: PairLink | null, onPairLink: (link: PairLink) => void): void {
  const handed = useRef(false);
  const latest = useRef(onPairLink);
  useEffect(() => {
    latest.current = onPairLink;
  }, [onPairLink]);
  useEffect(() => {
    if (!found || handed.current) return;
    handed.current = true;
    latest.current(found);
  }, [found]);
}

function openSettings(): void {
  Linking.openSettings().catch((error: unknown) => {
    logger.warn('[connect] Settings could not be opened', error);
  });
}

type ViewOf<K extends ScannerView['kind']> = Extract<ScannerView, { readonly kind: K }>;

type ViewfinderProps = {
  readonly view: ViewOf<'scanning'>;
  readonly dispatch: Dispatch<ScanAction>;
};

function Viewfinder({ view, dispatch }: ViewfinderProps) {
  const { colours, radii, spacing } = useTokens();
  const onScanned = ({ data }: BarcodeScanningResult) => dispatch({ type: 'scanned', data });
  return (
    <View style={{ gap: spacing.space5 }}>
      <View
        style={[
          styles.frame,
          {
            borderRadius: radii.panel,
            borderColor: colours.border,
            backgroundColor: colours.muted,
          },
        ]}
      >
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={QR_ONLY}
          onBarcodeScanned={view.reading ? onScanned : undefined}
          onMountError={() => dispatch({ type: 'cameraFailed' })}
          accessible
          accessibilityLabel={SCAN_COPY.camera}
        />
      </View>
      <StepNote note={{ tone: view.noteTone, text: view.note }} />
    </View>
  );
}

function NoCamera({ view, ask }: { readonly view: ViewOf<'no_camera'>; readonly ask: () => void }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space5 }}>
      <Text level={MESSAGE_LEVEL} accessibilityRole="alert">
        {view.message}
      </Text>
      {view.askAgain ? <Button label={SCAN_COPY.allowCamera} onPress={ask} fullWidth /> : null}
      {view.openSettings ? (
        <Button
          label={SCAN_COPY.openSettings}
          onPress={openSettings}
          variant={view.askAgain ? 'outline' : 'primary'}
          fullWidth
        />
      ) : null}
    </View>
  );
}

function Header({ onBack }: { readonly onBack: () => void }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      <View style={styles.back}>
        <IconButton icon={ChevronLeft} accessibilityLabel={SCAN_COPY.back} onPress={onBack} />
      </View>
      <Text variant="eyebrow">{SCAN_COPY.eyebrow}</Text>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {SCAN_COPY.title}
      </Text>
    </View>
  );
}

export function QrScanner({ onPairLink, onTypeCode, onBack }: QrScannerProps) {
  const { spacing } = useTokens();
  const [response, requestPermission] = useCameraPermissions();
  const [state, dispatch] = useReducer(scanReducer, INITIAL_SCAN);
  const permission = cameraPermissionOf(response);
  useAskOnOpen(permission, state.asked, requestPermission, dispatch);
  useHandOver(state.found, onPairLink);
  const view = scannerView(permission, state);
  const askAgain = () => {
    requestPermission().catch((error: unknown) => {
      logger.warn('[connect] the camera permission could not be asked for', error);
    });
  };
  return (
    <Screen scroll padding="space9">
      <View style={{ gap: spacing.space9 }}>
        <Header onBack={onBack} />
        {view.kind === 'scanning' ? <Viewfinder view={view} dispatch={dispatch} /> : null}
        {view.kind === 'no_camera' ? <NoCamera view={view} ask={askAgain} /> : null}
        {view.kind === 'asking' ? (
          <Text level={MESSAGE_LEVEL} tone="muted">
            {view.message}
          </Text>
        ) : null}
        <Button label={SCAN_COPY.typeCode} onPress={onTypeCode} variant="outline" fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  frame: { width: '100%', aspectRatio: 1, borderWidth: 1, overflow: 'hidden' },
});
