// The person's files in the cache (KR9; claims audit, 16 Nov): every way of leaving deletes the
// Deliverable viewer's copies AND the theme's downloaded fonts and mascot files, each clearer run
// even when another one failed to delete (each logs and never throws).

import { describe, expect, it, vi } from 'vitest';

const cleared = vi.hoisted(() => [] as string[]);

vi.mock('../../cc/deliverables/open-file', () => ({
  clearViewerFiles: () => void cleared.push('viewer files'),
}));
vi.mock('../../styles/themes/files', () => ({
  clearThemeFiles: () => void cleared.push('theme files'),
}));

const { USER_FILE_CLEARERS, clearUserFiles } = await import('../user-files');

describe('clearUserFiles', () => {
  it("deletes the viewer's copies and the theme's files", () => {
    clearUserFiles();
    expect(cleared).toEqual(['viewer files', 'theme files']);
    expect(USER_FILE_CLEARERS).toHaveLength(2);
    expect(Object.isFrozen(USER_FILE_CLEARERS)).toBe(true);
  });
});
