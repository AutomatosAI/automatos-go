// The scanner and the pairing link's shape, read from the source (vitest runs no React Native
// renderer): expo-camera's CameraView reads QR codes only; the camera is asked for only by the
// scanner, never at launch; Open Settings is Linking.openSettings; neither the scanner nor a link
// pairs or calls the server (KC8); KC13 is in the scanner's module comment and Connect says 'Scan it
// with Automatos Go'; the words come from strings.ts, the colours from the tokens.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { connectPrefillFromParams } from '../../navigation/routes';
import { CONNECT_SCREEN_COPY, PAIR_LINK_COPY, SCAN_COPY } from '../strings';

const ROOT = path.resolve(__dirname, '../../..');
const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), 'utf8');

const SCANNER_DIR = 'src/connect/scanner';
const SCANNER = readdirSync(path.join(ROOT, SCANNER_DIR)).map((file) => ({
  name: file,
  source: read(SCANNER_DIR, file),
}));
const COMPONENTS = SCANNER.filter(({ name }) => name.endsWith('.tsx'));
const qrScanner = read(SCANNER_DIR, 'QrScanner.tsx');
const pairLinkScreen = read(SCANNER_DIR, 'PairLinkScreen.tsx');
const scanRoute = read('app/connect/scan.tsx');
const pairRoute = read('app/go/pair.tsx');

/** Every source file under a folder, tests excluded. */
function sources(dir: string): readonly { readonly file: string; readonly text: string }[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
    const relative = path.join(dir, entry);
    if (entry === '__tests__') return [];
    if (statSync(path.join(ROOT, relative)).isDirectory()) return sources(relative);
    return /\.tsx?$/.test(entry) ? [{ file: relative, text: read(relative) }] : [];
  });
}

describe('the QR scanner (US-006g)', () => {
  it("is expo-camera's CameraView, reading QR codes only", () => {
    expect(qrScanner).toMatch(/from 'expo-camera'/);
    expect(qrScanner).toContain('<CameraView');
    expect(qrScanner).toMatch(/barcodeTypes: \['qr'\]/);
    expect(qrScanner).toContain('barcodeScannerSettings={QR_ONLY}');
  });

  it('stops reading once a code is found', () => {
    expect(qrScanner).toContain('onBarcodeScanned={view.reading ? onScanned : undefined}');
  });

  it('asks for the camera when it opens: only the scanner asks, nothing at launch', () => {
    expect(qrScanner).toContain('useCameraPermissions()');
    const askers = [...sources('src'), ...sources('app')].filter(({ text }) =>
      /useCameraPermissions|requestCameraPermissionsAsync/.test(text),
    );
    expect(askers.map(({ file }) => file)).toEqual([path.join(SCANNER_DIR, 'QrScanner.tsx')]);
  });

  it('opens Settings with Linking.openSettings, and always offers Type the code', () => {
    expect(qrScanner).toContain('Linking.openSettings()');
    expect(qrScanner).toContain('label={SCAN_COPY.openSettings}');
    expect(qrScanner).toContain('label={SCAN_COPY.typeCode}');
  });

  it('carries KC13 in its module comment', () => {
    const header = qrScanner.slice(0, qrScanner.indexOf('import '));
    expect(header).toContain('KC13');
    expect(header).toContain('associatedDomains');
    expect(header).toContain('applinks:ui.automatos.app');
  });
});

describe('a scan and a link never pair (KC8)', () => {
  const PAIRS =
    /pairDevice|connect-steps|use-connect|useConnect|useServerSwitch|connectTo|api\/client|createApiClient|\.\.\/api'|fetch\(/;

  it('nothing in the scanner folder or the two routes calls the server or saves a pairing', () => {
    for (const { name, source } of [
      ...SCANNER,
      { name: 'scan.tsx', source: scanRoute },
      { name: 'pair.tsx', source: pairRoute },
    ]) {
      expect(source, name).not.toMatch(PAIRS);
    }
  });

  it('a valid scan goes back to Connect prefilled, which stops at the confirm card', () => {
    expect(scanRoute).toContain('<QrScanner');
    expect(scanRoute).toContain('router.dismissTo(connectRouteFor(link))');
  });

  it('a link is read with parsePairLink and goes to Connect by replacing itself', () => {
    expect(pairRoute).toContain('<PairLinkScreen params={useLocalSearchParams()} />');
    expect(pairLinkScreen).toContain('parsePairLink(pairLinkFromParams(params))');
    expect(pairLinkScreen).toContain('router.replace(route)');
    expect(pairLinkScreen).not.toMatch(/router\.push/);
  });

  it('Connect asks the switch question itself, so a crafted automatos://connect link cannot skip it', () => {
    const connectScreen = read('src/connect/screens/ConnectScreen.tsx');
    expect(connectScreen).toContain('question={connectSwitchQuestion(prefill, inUse)}');
    expect(connectScreen).toContain('<SwitchQuestion');
    expect(connectScreen).toContain('key={prefillKey(prefill)}');
    // the answer is a prop from /go/pair, never a route param: /connect's route passes the prefill only
    expect(read('app/connect/index.tsx')).toMatch(/<ConnectScreen prefill=\{prefill\} \/>/);
    expect(
      connectPrefillFromParams({ origin: 'nas.local', code: 'ABCD-EFGH', switchAnswered: 'true' }),
    ).toEqual({ origin: 'nas.local', code: 'ABCD-EFGH' });
  });

  it('/go/pair opens Connect, told the question was answered, only after the yes for that link', () => {
    expect(pairLinkScreen).toContain('if (agreed === answering)');
    expect(pairLinkScreen).toContain('<ConnectScreen prefill={intake.prefill} switchAnswered />');
    expect(pairLinkScreen).toContain('onConnect={() => setAgreed(answering)}');
  });

  it('logs nothing about the link or the code', () => {
    for (const { name, source } of [...SCANNER, { name: 'pair.tsx', source: pairRoute }]) {
      for (const call of source.match(/logger\.\w+\([^;]*/g) ?? []) {
        expect(call, name).not.toMatch(/link|code|data|params/i);
      }
    }
  });
});

describe('the scanner components', () => {
  it('export exactly one component per file, named after the file', () => {
    for (const { name, source } of COMPONENTS) {
      expect(source.match(/^export function [A-Z]\w*/gm), name).toEqual([
        `export function ${path.basename(name, '.tsx')}`,
      ]);
    }
  });

  it('take their words from strings.ts, never a literal in JSX text', () => {
    for (const { name, source } of COMPONENTS) {
      expect(source, name).not.toMatch(/>\s*[A-Za-z][^<>{}]*</);
    }
  });

  it('read colours from the tokens only', () => {
    for (const { name, source } of [...COMPONENTS, { name: 'scan.tsx', source: scanRoute }]) {
      expect(source, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/);
    }
  });
});

describe('the copy', () => {
  it("Connect tells people to scan with Automatos Go, not the phone's Camera (KC13)", () => {
    expect(CONNECT_SCREEN_COPY.lead).toContain('Scan it with Automatos Go');
  });

  it('names no status code, no internal, and the code nowhere', () => {
    for (const words of [...Object.values(SCAN_COPY), ...Object.values(PAIR_LINK_COPY)]) {
      expect(words).not.toMatch(/(?<![\d.])[1-5]\d\d(?![\d.])|status|exception|null|undefined/i);
      expect(words).not.toMatch(/[A-Z2-9]{4}-[A-Z2-9]{4}/);
    }
  });

  it('points nowhere near making an account (D-SIGNIN)', () => {
    for (const words of [...Object.values(SCAN_COPY), ...Object.values(PAIR_LINK_COPY)]) {
      expect(words).not.toMatch(/account|sign[ -]?up|register/i);
    }
  });
});
