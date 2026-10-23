import type { DocumentPickerAsset } from 'expo-document-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { describe, expect, it } from 'vitest';

import {
  MAX_ATTACHMENTS,
  NOTHING_PICKED,
  cameraOptions,
  documentOptions,
  libraryOptions,
  pickOf,
  pickedDocuments,
  pickedPhotos,
  roomFor,
  untitledName,
} from '../attachments/picked';
import { ATTACH_COPY } from '../strings';

const NOW = new Date(2026, 9, 23, 8, 30, 12);

function photo(overrides: Partial<ImagePickerAsset>): ImagePickerAsset {
  return {
    uri: 'file:///cache/ImagePicker/0B1E.heic',
    width: 4032,
    height: 3024,
    type: 'image',
    fileName: 'IMG_0042.HEIC',
    mimeType: 'image/heic',
    ...overrides,
  };
}

function document(overrides: Partial<DocumentPickerAsset>): DocumentPickerAsset {
  return {
    uri: 'file:///cache/DocumentPicker/9C2A.pdf',
    name: 'q3-report.pdf',
    mimeType: 'application/pdf',
    size: 88_000,
    lastModified: 0,
    ...overrides,
  };
}

describe('the picker options', () => {
  it('asks the camera and the library for still photos at full quality, without EXIF', () => {
    for (const options of [cameraOptions(), libraryOptions(4)]) {
      expect(options).toMatchObject({
        mediaTypes: ['images'],
        quality: 1,
        exif: false,
        allowsEditing: false,
        base64: false,
      });
    }
  });

  it("lets the library take as many as the message has room for, the server's limit at most", () => {
    expect(libraryOptions(4)).toMatchObject({ allowsMultipleSelection: true, selectionLimit: 4 });
    expect(libraryOptions(1)).toMatchObject({ allowsMultipleSelection: false, selectionLimit: 1 });
    expect(libraryOptions(99).selectionLimit).toBe(MAX_ATTACHMENTS);
  });

  it('opens Files for any file, copied where it can be read', () => {
    expect(documentOptions()).toEqual({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
      base64: false,
    });
  });
});

describe('picked assets', () => {
  it("keeps a photo's name and type", () => {
    expect(pickedPhotos([photo({})], NOW)).toEqual([
      { uri: 'file:///cache/ImagePicker/0B1E.heic', name: 'IMG_0042.HEIC', mime: 'image/heic' },
    ]);
  });

  it('names a photo the picker gave no name, and types it by its extension', () => {
    const picked = pickedPhotos(
      [
        photo({ fileName: null, mimeType: undefined, uri: 'file:///cache/ImagePicker/A1.jpg' }),
        photo({ fileName: '', mimeType: undefined, uri: 'file:///cache/ImagePicker/A2.png' }),
      ],
      NOW,
    );
    expect(picked).toEqual([
      {
        uri: 'file:///cache/ImagePicker/A1.jpg',
        name: `${ATTACH_COPY.untitledPhoto}-20261023-083012.jpg`,
        mime: 'image/jpeg',
      },
      {
        uri: 'file:///cache/ImagePicker/A2.png',
        name: `${ATTACH_COPY.untitledPhoto}-20261023-083012-2.png`,
        mime: 'image/png',
      },
    ]);
  });

  it('leaves a video the picker let through, and stops at the limit', () => {
    const picked = pickedPhotos(
      [
        photo({ type: 'video' }),
        photo({}),
        photo({ fileName: 'b.jpg' }),
        photo({ fileName: 'c.jpg' }),
      ],
      NOW,
      2,
    );
    expect(picked.map((file) => file.name)).toEqual(['IMG_0042.HEIC', 'b.jpg']);
    expect(pickedPhotos(null, NOW)).toEqual([]);
  });

  it("keeps a document's name and type, and leaves one past the message's room", () => {
    const chosen = [document({}), document({ name: 'brief.docx', mimeType: undefined })];
    const files = pickedDocuments(chosen, NOW, 1);
    expect(files).toEqual([
      {
        uri: 'file:///cache/DocumentPicker/9C2A.pdf',
        name: 'q3-report.pdf',
        mime: 'application/pdf',
      },
    ]);
    expect(pickOf(chosen, files)).toEqual({ files, left: 1 });
    expect(pickedDocuments([document({ name: ' ', mimeType: undefined })], NOW)[0]).toMatchObject({
      name: untitledName(ATTACH_COPY.untitledFile, NOW, 0),
      mime: '',
    });
  });

  it('counts the room a message has left', () => {
    expect(roomFor(0)).toBe(MAX_ATTACHMENTS);
    expect(roomFor(MAX_ATTACHMENTS - 1)).toBe(1);
    expect(roomFor(MAX_ATTACHMENTS + 5)).toBe(0);
    expect(NOTHING_PICKED).toEqual({ files: [], left: 0 });
  });
});
