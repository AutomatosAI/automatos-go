// The theme-file allowlist (D-NO-CODE, docs/theme-host/mobile.md 'What the phone may load'): only
// a relative /api/themes/files/<digest>/<path> URL for a font or a mascot file; never an absolute,
// protocol-relative or foreign URL, a dot segment, a query or escape, or a code file; the copy is
// named by its digest path and fetched from the configured API server only.

import { describe, expect, it } from 'vitest';

import { STYLE_ROUTES } from '../../routes';
import {
  THEME_FILES_PREFIX,
  THEME_FILE_MAX_BYTES,
  allowedThemeUrl,
  themeFile,
  themeFileSegments,
  themeFileSource,
} from '../file-url';
import { DIGEST, FONT_URL, fileUrl } from './fixtures';

const CLIP_URL = fileUrl('assets/mascot/idle.mp4');
const STILL_URL = fileUrl('assets/mascot/idle.png');

describe('the one prefix', () => {
  it('is the files route up to its first parameter', () => {
    expect(THEME_FILES_PREFIX).toBe('/api/themes/files/');
    expect(STYLE_ROUTES.themes.file.path.startsWith(THEME_FILES_PREFIX)).toBe(true);
  });
});

describe('what the phone may load', () => {
  it('takes a font and a mascot clip or still under the files route', () => {
    expect(themeFile(FONT_URL, 'font')).toEqual({
      url: FONT_URL,
      kind: 'font',
      digest: DIGEST,
      path: 'assets/fonts/mobile/inter-regular.ttf',
      maxBytes: 400 * 1024,
    });
    expect(themeFile(fileUrl('assets/fonts/mobile/Fraunces-Bold.otf'), 'font')).not.toBeNull();
    expect(themeFile(CLIP_URL, 'mascot')?.maxBytes).toBe(2 * 1024 * 1024);
    expect(themeFile(STILL_URL, 'mascot')?.path).toBe('assets/mascot/idle.png');
  });

  it('refuses an absolute URL, even to the same server', () => {
    for (const url of [
      `https://api.example.test${FONT_URL}`,
      `http://evil.example${FONT_URL}`,
      `HTTPS://api.example.test${FONT_URL}`,
    ]) {
      expect(themeFile(url, 'font')).toBeNull();
    }
  });

  it('refuses a protocol-relative URL and any doubled slash', () => {
    expect(themeFile(`//evil.example${FONT_URL}`, 'font')).toBeNull();
    expect(themeFile(fileUrl('assets//fonts/mobile/a.ttf'), 'font')).toBeNull();
    expect(themeFile(`/api/themes/files//${DIGEST}/assets/fonts/mobile/a.ttf`, 'font')).toBeNull();
  });

  it("refuses a scheme or a host in place of the path ('javascript:', 'file:', 'data:')", () => {
    for (const url of [
      'javascript:alert(1)',
      `file:///etc/passwd`,
      'data:font/ttf;base64,AAAA',
      `api.example.test${FONT_URL}`,
    ]) {
      expect(themeFile(url, 'font')).toBeNull();
    }
  });

  it("refuses '..' and '.' segments, raw or escaped", () => {
    for (const url of [
      fileUrl('assets/fonts/mobile/../../../theme.json'),
      fileUrl('assets/fonts/mobile/./a.ttf'),
      `/api/themes/files/../${DIGEST}/assets/fonts/mobile/a.ttf`,
      fileUrl('assets/fonts/mobile/%2e%2e/a.ttf'),
      fileUrl('assets/fonts/mobile/a..b.ttf'),
    ]) {
      expect(themeFile(url, 'font')).toBeNull();
    }
  });

  it('refuses a code file whatever its folder: .js, .mjs, .css, .html', () => {
    for (const path of [
      'dist/entry.js',
      'dist/theme.css',
      'assets/fonts/mobile/inter.js',
      'assets/fonts/mobile/inter.mjs',
      'assets/mascot/idle.html',
      'assets/mascot/idle.css',
    ]) {
      expect(themeFile(fileUrl(path), 'font')).toBeNull();
      expect(themeFile(fileUrl(path), 'mascot')).toBeNull();
    }
  });

  it('refuses a file of the other kind or outside its folder', () => {
    expect(themeFile(FONT_URL, 'mascot')).toBeNull();
    expect(themeFile(CLIP_URL, 'font')).toBeNull();
    expect(themeFile(fileUrl('assets/fonts/inter.woff2'), 'font')).toBeNull();
    expect(themeFile(fileUrl('assets/mascot/idle.webm'), 'mascot')).toBeNull();
    expect(themeFile(fileUrl('theme.json'), 'font')).toBeNull();
    expect(themeFile(fileUrl('assets/mascot/Idle.png'), 'mascot')).toBeNull();
  });

  it('refuses a digest that is not 64 lowercase hex, and a URL with no file', () => {
    expect(themeFile(fileUrl('assets/fonts/mobile/a.ttf', 'A'.repeat(64)), 'font')).toBeNull();
    expect(themeFile(fileUrl('assets/fonts/mobile/a.ttf', 'a'.repeat(63)), 'font')).toBeNull();
    expect(themeFile(`/api/themes/files/${DIGEST}`, 'font')).toBeNull();
    expect(themeFile('/api/themes/files/', 'font')).toBeNull();
  });

  it('refuses a query, a fragment, whitespace, a backslash or a control character', () => {
    for (const url of [
      `${FONT_URL}?v=2`,
      `${FONT_URL}#x`,
      fileUrl('assets/fonts/mobile/a b.ttf'),
      fileUrl('assets\\fonts/mobile/a.ttf'),
      `${FONT_URL}\n`,
    ]) {
      expect(themeFile(url, 'font')).toBeNull();
    }
  });

  it('refuses anything that is not a string', () => {
    for (const url of [null, undefined, 42, {}, ['/api/themes/files/']]) {
      expect(themeFile(url, 'font')).toBeNull();
      expect(allowedThemeUrl(url, 'font')).toBeNull();
    }
    expect(allowedThemeUrl(FONT_URL, 'font')).toBe(FONT_URL);
  });
});

describe('where a file comes from and lands', () => {
  it('is fetched from the configured API server only', () => {
    const file = themeFile(FONT_URL, 'font');
    if (!file) throw new Error('the font URL should be allowed');
    expect(themeFileSource('https://api.example.test/', file)).toBe(
      `https://api.example.test${FONT_URL}`,
    );
    expect(themeFileSource('http://192.168.1.20:8000', file)).toBe(
      `http://192.168.1.20:8000${FONT_URL}`,
    );
  });

  it('lands at its digest path (content-addressed)', () => {
    const file = themeFile(CLIP_URL, 'mascot');
    if (!file) throw new Error('the clip URL should be allowed');
    expect(themeFileSegments(file)).toEqual([DIGEST, 'assets', 'mascot', 'idle.mp4']);
  });

  it('caps fonts at core’s 400 KB and mascot files at 2 MB', () => {
    expect(THEME_FILE_MAX_BYTES).toEqual({ font: 409_600, mascot: 2_097_152 });
  });
});
