// Where a link in Auto's answer opens (OT-C8): through the foundation's web-link mapping for the
// app's own pages and Studio's (one tap), the system's own app for any other web page or an email
// address (after the reader sees its host and address: markdownLink's site), and nowhere for
// anything else (the words show as plain text). Never a WebView.

import { describe, expect, it } from 'vitest';

import { markdownLink, markdownLinkTarget } from '../links';

const WEB = 'https://ui.automatos.app';

describe('markdownLinkTarget', () => {
  it('maps an internal path the phone has a screen for to that screen', () => {
    expect(markdownLinkTarget('/command-center?tab=board&task_id=42', WEB)).toEqual({
      app: '/cc/ticket/42',
    });
    expect(markdownLinkTarget(' /deliverables?deliverable=7 ', WEB)).toEqual({
      app: '/cc/deliverables/7',
    });
  });

  it('opens any other internal path in Studio, in the system browser', () => {
    expect(markdownLinkTarget('/agents?agent=3', WEB)).toEqual({
      external: `${WEB}/agents?agent=3`,
    });
  });

  it('treats a full link to the current Studio as Studio’s own path', () => {
    expect(markdownLinkTarget(`${WEB}/command-center?tab=board&task_id=42`, WEB)).toEqual({
      app: '/cc/ticket/42',
    });
    expect(markdownLinkTarget(`${WEB}/agents`, `${WEB}/`)).toEqual({ external: `${WEB}/agents` });
    // Studio's home has no screen on the phone: it opens in the browser
    expect(markdownLinkTarget(WEB, WEB)).toEqual({ external: `${WEB}/` });
  });

  it('opens another web page or an email address in the system’s own app', () => {
    expect(markdownLinkTarget('https://example.com/a?b=1#c', WEB)).toEqual({
      external: 'https://example.com/a?b=1#c',
    });
    expect(markdownLinkTarget('http://example.com', WEB)).toEqual({
      external: 'http://example.com',
    });
    expect(markdownLinkTarget('mailto:hi@automatos.app', WEB)).toEqual({
      external: 'mailto:hi@automatos.app',
    });
    // a host that only starts like Studio's is another site, opened as one
    expect(markdownLinkTarget(`${WEB}.evil.example/x`, WEB)).toEqual({
      external: `${WEB}.evil.example/x`,
    });
  });

  it('makes nothing else a link', () => {
    for (const href of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<b>x</b>',
      'file:///etc/passwd',
      'tel:+351000000',
      'automatos://cc/board',
      '//evil.example/x',
      'relative/path',
      '#anchor',
      'https://',
      `https://studio@evil.example/`,
      `${WEB}@evil.example/`,
      'https://example.com/a b',
      'https://example.com/\u0000',
      '',
      '   ',
    ]) {
      expect(markdownLinkTarget(href, WEB), href).toBeNull();
    }
  });

  it('opens no Studio page when the current server has no Studio address', () => {
    expect(markdownLinkTarget('/agents', '')).toBeNull();
    expect(markdownLinkTarget('/chat?chatId=c-1', '')).toEqual({ app: '/chat/c-1' });
    expect(markdownLinkTarget('https://example.com', '')).toEqual({
      external: 'https://example.com',
    });
  });
});

describe('markdownLink: another site is named before it opens', () => {
  it('opens an app screen or a Studio page at once: no site to confirm', () => {
    expect(markdownLink('/command-center?tab=board&task_id=42', WEB)).toEqual({
      target: { app: '/cc/ticket/42' },
      site: null,
    });
    expect(markdownLink(`${WEB}/agents`, WEB)).toEqual({
      target: { external: `${WEB}/agents` },
      site: null,
    });
  });

  it('names another site by its host, lower-cased, port kept, with the full address', () => {
    const phishing = 'https://ui-automatos.app.Evil.example:8443/login?next=/board#x';
    expect(markdownLink(phishing, WEB)).toEqual({
      target: { external: phishing },
      site: { host: 'ui-automatos.app.evil.example:8443', address: phishing },
    });
    // a host that only starts like Studio's is another site, and is named as one
    expect(markdownLink(`${WEB}.evil.example/x`, WEB)?.site?.host).toBe(
      'ui.automatos.app.evil.example',
    );
    expect(markdownLink('http://example.com', WEB)?.site?.host).toBe('example.com');
  });

  it('names an email link by its address', () => {
    expect(markdownLink('mailto:hi@automatos.app', WEB)).toEqual({
      target: { external: 'mailto:hi@automatos.app' },
      site: { host: 'hi@automatos.app', address: 'mailto:hi@automatos.app' },
    });
  });

  it('is no link where markdownLinkTarget is none', () => {
    for (const href of ['javascript:alert(1)', '//evil.example/x', '#anchor', '']) {
      expect(markdownLink(href, WEB), href).toBeNull();
    }
    expect(markdownLink('/agents', '')).toBeNull();
  });
});
