import { describe, expect, it } from 'vitest';

import { buildUrl, fillPath, queryString, withoutTrailingSlash } from '../url';

describe('fillPath', () => {
  it('fills every {name} segment, URI-encoded', () => {
    expect(
      fillPath('/api/v1/approval-grants/{grantId}/{verb}', { grantId: 42, verb: 'grant' }),
    ).toBe('/api/v1/approval-grants/42/grant');
    expect(fillPath('/api/chat/{chatId}', { chatId: 'é/#?&' })).toBe(
      '/api/chat/%C3%A9%2F%23%3F%26',
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
