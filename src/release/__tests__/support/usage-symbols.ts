// scripts/release/usage-symbols.json as the IPA scan's test reads it (test-only, US-021h): its zod
// schema and the AC's symbol → key list, which the file must keep (it may require more, never less).

import { z } from 'zod';

import { readRepoFile } from './tree';

export const USAGE_SYMBOLS_PATH = 'scripts/release/usage-symbols.json';

/** US-021h's list: symbol → the key(s) a binary that references it needs, or forbidden (KR10). */
export const AC_REQUIRED: Readonly<Record<string, readonly string[] | 'forbidden'>> = {
  PHAsset: ['NSPhotoLibraryUsageDescription'],
  PHPhotoLibrary: ['NSPhotoLibraryUsageDescription'],
  UIImageWriteToSavedPhotosAlbum: ['NSPhotoLibraryAddUsageDescription'],
  PHAccessLevelAddOnly: ['NSPhotoLibraryAddUsageDescription'],
  AVCaptureDevice: ['NSCameraUsageDescription'],
  requestRecordPermission: ['NSMicrophoneUsageDescription'],
  AVAudioApplication: ['NSMicrophoneUsageDescription'],
  SFSpeechRecognizer: ['NSSpeechRecognitionUsageDescription'],
  CMMotionManager: ['NSMotionUsageDescription'],
  CMMotionActivityManager: ['NSMotionUsageDescription'],
  CMPedometer: ['NSMotionUsageDescription'],
  CLLocationManager: ['NSLocationWhenInUseUsageDescription'],
  CNContactStore: ['NSContactsUsageDescription'],
  EKEventStore: ['NSCalendarsFullAccessUsageDescription'],
  LAContext: ['NSFaceIDUsageDescription'],
  MPMediaLibrary: ['NSAppleMusicUsageDescription'],
  CBCentralManager: ['NSBluetoothAlwaysUsageDescription'],
  CBPeripheralManager: ['NSBluetoothAlwaysUsageDescription'],
  HKHealthStore: ['NSHealthShareUsageDescription'],
  NFCNDEFReaderSession: ['NFCReaderUsageDescription'],
  NWBrowser: ['NSLocalNetworkUsageDescription'],
  NSNetServiceBrowser: ['NSLocalNetworkUsageDescription'],
  ATTrackingManager: 'forbidden',
};

const text = z.string().trim().min(1);

const symbolSchema = z
  .object({
    symbol: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    // the name docs/native-modules.md and ios-usage-keys.json use, when the bytes searched differ
    doc: text.optional(),
    framework: z.string().regex(/^\w+$/),
    keys: z.array(z.string().regex(/^[A-Za-z]+UsageDescription$/)),
    forbidden: z.literal(true).optional(),
    reason: text,
  })
  .strict()
  .refine((entry) => (entry.forbidden ? entry.keys.length === 0 : entry.keys.length > 0), {
    message: 'a forbidden symbol has no key; any other needs at least one',
  });

export const usageSymbolsSchema = z
  .object({
    about: text,
    reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    symbols: z.array(symbolSchema).min(1),
  })
  .strict();

export type UsageSymbols = z.infer<typeof usageSymbolsSchema>;
export type UsageSymbol = UsageSymbols['symbols'][number];

export function readUsageSymbols(): UsageSymbols {
  return usageSymbolsSchema.parse(JSON.parse(readRepoFile(USAGE_SYMBOLS_PATH)));
}

/** The entry that stands for a docs class name ('AVAudioSession.requestRecordPermission'). */
export function symbolForDocClass(
  symbols: readonly UsageSymbol[],
  docClass: string,
): UsageSymbol | undefined {
  return symbols.find((entry) => (entry.doc ?? entry.symbol) === docClass);
}
