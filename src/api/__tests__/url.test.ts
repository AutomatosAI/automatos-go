import { describe, expect, it } from 'vitest';

import {
  FILE_NAME_PARAMS,
  buildUrl,
  fillPath,
  isFileNameSegment,
  isIdSegment,
  isWellFormed,
  queryString,
  withoutTrailingSlash,
} from '../url';

describe('fillPath', () => {
  it('fills every {name} segment, URI-encoded', () => {
    expect(
      fillPath('/api/v1/approval-grants/{grantId}/{verb}', { grantId: 42, verb: 'grant' }),
    ).toBe('/api/v1/approval-grants/42/grant');
    expect(fillPath('/api/chat/{chatId}', { chatId: '9b1c2a54-0000-4000-8000-0000000000d1' })).toBe(
      '/api/chat/9b1c2a54-0000-4000-8000-0000000000d1',
    );
  });

  it('refuses an id that could leave its segment, before any request is made', () => {
    for (const hostile of [
      'a/../b',
      'a%2F..%2Fb',
      '%2e%2e',
      'a\\b',
      'a\u0000b',
      'a b',
      'é',
      'a?b',
      'a#b',
      'x'.repeat(129),
    ]) {
      expect(isIdSegment(hostile)).toBe(false);
      expect(() => fillPath('/api/chat/{chatId}', { chatId: hostile })).toThrow(TypeError);
    }
    for (const id of ['42', 'c-1', 'AbC_9.x', 'x'.repeat(128), 'Zm9vYmFy_-']) {
      expect(isIdSegment(id)).toBe(true);
    }
  });

  it('holds a file name the server chose to its own, looser rule, encoded whole', () => {
    expect(FILE_NAME_PARAMS).toEqual(new Set(['file_name', 'filename']));
    const media = '/api/socials/posts/{post_id}/media/{file_name}';
    expect(fillPath(media, { post_id: 'p-1', file_name: 'image-1.png' })).toBe(
      '/api/socials/posts/p-1/media/image-1.png',
    );
    expect(fillPath('/api/documents/generated/{filename}', { filename: 'Q3 report (é).pdf' })).toBe(
      `/api/documents/generated/${encodeURIComponent('Q3 report (é).pdf')}`,
    );
    for (const name of ['100%.pdf', 'a..b.pdf', '.hidden', 'x'.repeat(255)]) {
      expect(isFileNameSegment(name)).toBe(true);
    }
  });

  it('refuses a file name with a slash, a backslash, a control character or a dot segment, encoded or not', () => {
    for (const hostile of [
      '',
      '.',
      '..',
      'a/b.pdf',
      '../../etc/passwd',
      'a\\b.pdf',
      'a%2Fb.pdf',
      'a%5cb.pdf',
      '%2e%2e',
      '%2E',
      'a\u0000b',
      'a%00b',
      'a\u0085b',
      'a\nb',
      'x'.repeat(256),
    ]) {
      expect(isFileNameSegment(hostile)).toBe(false);
      expect(() => fillPath('/api/documents/generated/{filename}', { filename: hostile })).toThrow(
        TypeError,
      );
    }
  });

  it('names the parameter, never its value, in what it throws', () => {
    expect(() => fillPath('/api/chat/{chatId}', { chatId: 'secret/../x' })).toThrow(
      'Path parameter "chatId" is missing or not a usable segment',
    );
  });

  it('leaves a path without params alone', () => {
    expect(fillPath('/api/workspaces/current')).toBe('/api/workspaces/current');
  });

  it('throws for a missing, empty or dot-segment param', () => {
    expect(() => fillPath('/api/chat/{chatId}', {})).toThrow(TypeError);
    expect(() => fillPath('/api/chat/{chatId}', { chatId: '' })).toThrow(TypeError);
    expect(() => fillPath('/api/chat/{chatId}', { chatId: '.' })).toThrow(TypeError);
    expect(() => fillPath('/api/chat/{chatId}', { chatId: '..' })).toThrow(TypeError);
  });

  it('never reads a param off the object prototype', () => {
    expect(() => fillPath('/api/x/{constructor}', {})).toThrow(TypeError);
  });
});

describe('queryString', () => {
  it('encodes keys and values and skips null and undefined', () => {
    expect(
      queryString({ q: 'a&b c', limit: 20, archived: false, none: null, gone: undefined }),
    ).toBe('?q=a%26b%20c&limit=20&archived=false');
  });

  it('is empty without values', () => {
    expect(queryString()).toBe('');
    expect(queryString({ gone: undefined })).toBe('');
  });
});

describe('buildUrl', () => {
  it('joins the base URL without doubling the slash', () => {
    expect(buildUrl('https://api.example.test/', '/api/chat/{id}', { id: 'c-1' }, { a: 1 })).toBe(
      'https://api.example.test/api/chat/c-1?a=1',
    );
    expect(withoutTrailingSlash('https://api.example.test///')).toBe('https://api.example.test');
  });
});

describe('withoutTrailingSlash', () => {
  it('drops only the slashes at the end', () => {
    expect(withoutTrailingSlash('/a//b/')).toBe('/a//b');
    expect(withoutTrailingSlash('///')).toBe('');
    expect(withoutTrailingSlash('')).toBe('');
    expect(withoutTrailingSlash('/a')).toBe('/a');
  });

  it('reads a long run of slashes that does not end the text once, not again from every slash', () => {
    // /\/+$/ took over a second on this in node (quadratic); one read back from the end takes none
    const hostile = `${'/'.repeat(50_000)}x`;
    const started = performance.now();
    expect(withoutTrailingSlash(hostile)).toBe(hostile);
    expect(withoutTrailingSlash(`${hostile}${'/'.repeat(50_000)}`)).toBe(hostile);
    expect(performance.now() - started).toBeLessThan(100);
  });
});

describe('what the builder refuses with its own error, before any encoder throws', () => {
  const high = String.fromCharCode(0xd800);
  const low = String.fromCharCode(0xdc00);

  it('a route path that does not start with exactly one slash', () => {
    for (const path of ['evil.example/x', 'api/chat', '//evil.example/x', '']) {
      expect(() => buildUrl('https://api.example.test', path), path).toThrow(
        new TypeError('A route path must start with exactly one "/"'),
      );
    }
    expect(buildUrl('https://api.example.test', '/api/chat')).toBe(
      'https://api.example.test/api/chat',
    );
  });

  it('a lone surrogate in a path value: a TypeError naming the parameter, never a URIError', () => {
    for (const name of [`a${high}.png`, `a${low}.png`, `${low}${high}.png`]) {
      expect(() => fillPath('/m/{file_name}', { file_name: name })).toThrow(TypeError);
      expect(() => fillPath('/m/{file_name}', { file_name: name })).toThrow(/"file_name"/);
    }
    expect(fillPath('/m/{file_name}', { file_name: `a${high}${low}.png` })).toBe(
      '/m/a%F0%90%80%80.png',
    );
  });

  it('a lone surrogate in a query key or value: a TypeError that repeats neither', () => {
    expect(() => queryString({ path: `q${high}` })).toThrow(
      new TypeError('A query parameter is not a usable value'),
    );
    expect(() => queryString({ [`k${low}`]: 'v' })).toThrow(TypeError);
    expect(queryString({ path: `q${high}${low}` })).toBe('?path=q%F0%90%80%80');
  });

  it('isWellFormed knows a pair from a lone half', () => {
    expect([`${high}${low}`, 'plain', ''].map(isWellFormed)).toEqual([true, true, true]);
    expect([high, low, `${low}${high}`, `x${high}`].map(isWellFormed)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
