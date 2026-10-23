// The three pickers behind the composer's [+] (US-009b). The camera's permission is asked when
// Camera is tapped, never at launch, and only there: the photo library and Files are the system's
// own pickers (picked.ts), which need no permission. Each resolves to the files chosen (none when
// the picker was closed); a picker that fails rejects, and the menu says so.

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import {
  cameraOptions,
  documentOptions,
  libraryOptions,
  pickedDocuments,
  pickOf,
  pickedPhotos,
  NOTHING_PICKED,
  type PickResult,
} from './picked';

/** Asks for the camera now (the system prompt once; afterwards the answer given). */
export async function askForCamera(): Promise<boolean> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  return permission.granted;
}

export async function takePhoto(): Promise<PickResult> {
  const result = await ImagePicker.launchCameraAsync(cameraOptions());
  return result.canceled
    ? NOTHING_PICKED
    : pickOf(result.assets, pickedPhotos(result.assets, new Date(), 1));
}

export async function choosePhotos(limit: number): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync(libraryOptions(limit));
  if (result.canceled) return NOTHING_PICKED;
  return pickOf(result.assets, pickedPhotos(result.assets, new Date(), limit));
}

/** Files lets several be chosen at once: past the message's room they are left (the menu says). */
export async function chooseFiles(limit: number): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync(documentOptions());
  if (result.canceled) return NOTHING_PICKED;
  return pickOf(result.assets, pickedDocuments(result.assets, new Date(), limit));
}
