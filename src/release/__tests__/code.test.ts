// The comment-free reader the code audits use (support/code.ts): it removes every comment and
// nothing else, so an audit reads what the code does and a string, a URL or copy with an
// apostrophe is not cut short.

import { describe, expect, it } from 'vitest';

import { codeOf, stripComments } from './support/code';
import { readRepoFile } from './support/tree';

describe('stripComments', () => {
  it('removes line, block and doc comments', () => {
    const code = stripComments(
      'a.ts',
      ['// one', '/* two */ const a = 1; // three', '/** four */', 'export { a };'].join('\n'),
    );
    expect(code).not.toMatch(/one|two|three|four/);
    expect(code).toContain('const a = 1;');
    expect(code).toContain('export { a };');
  });

  it("keeps a '//' inside a string and a template", () => {
    const code = stripComments(
      'b.ts',
      "const url = 'https://automatos.app/privacy';\nconst t = `//x`;",
    );
    expect(code).toContain("'https://automatos.app/privacy'");
    expect(code).toContain('`//x`');
  });

  it('parses .tsx as TSX: JSX text with an apostrophe or a URL stays, its comments go', () => {
    const code = stripComments(
      'c.tsx',
      "export const C = () => (\n  <Text>\n    {/* hidden */}\n    Don't miss https://x.test\n  </Text>\n);",
    );
    expect(code).toContain("Don't miss https://x.test");
    expect(code).not.toContain('hidden');
  });

  it('reads a repo file by its path', () => {
    const file = 'src/chat/attachments/upload.ts';
    expect(readRepoFile(file)).toContain('// One attachment');
    expect(codeOf(file)).not.toContain('// One attachment');
    expect(codeOf(file)).toContain('export async function sendAttachment(');
  });
});
