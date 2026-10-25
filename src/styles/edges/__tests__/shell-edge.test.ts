// The gate's edge screens in the shell (US-016j): the slot draws the edge the root layout hands it
// with the gate's props, and the gate's own state without one (rendered with react-dom's server
// renderer, as the connect kit's shell test does), and the wiring, read from the source: the root
// layout puts GateEdge in the slot around the screens, the signed-in layout gives the gate
// ShellEdgeScreen as its edge, and GateEdge renders EdgeScreen for an error and the styled Not
// running for an own server that does not answer.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as React from 'react';
import { createElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SERVER } from '../../../api/__tests__/fake-transport';
import type { GateEdgeProps } from '../../../app-state/AppGate';
import { EdgeScreenSlot, ShellEdgeScreen } from '../ShellEdgeScreen';

// vitest compiles the .tsx with the classic JSX runtime, which reads a global React
vi.stubGlobal('React', React);

// react-dom ships no types here (@types/react-dom is not a dependency): typed at the one call used
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  readonly renderToStaticMarkup: (element: ReactElement) => string;
};

const ROOT = path.resolve(__dirname, '../../../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

const PROPS: GateEdgeProps = Object.freeze({
  view: { kind: 'error', step: 'discovery', error: new Error('offline') } as const,
  server: SERVER,
  serverName: 'Automatos',
  onRetry: () => undefined,
  leave: () => null,
  fallback: 'gate-state',
});

describe('the edge slot', () => {
  it("draws the edge handed to it, with the gate's props", () => {
    const seen: GateEdgeProps[] = [];
    const Edge = (props: GateEdgeProps) => {
      seen.push(props);
      return `edge:${props.view.kind}`;
    };
    const markup = renderToStaticMarkup(
      createElement(EdgeScreenSlot, { edge: Edge }, createElement(ShellEdgeScreen, PROPS)),
    );
    expect(markup).toBe('edge:error');
    expect(seen).toEqual([PROPS]);
  });

  it("shows the gate's own state with no slot above it", () => {
    expect(renderToStaticMarkup(createElement(ShellEdgeScreen, PROPS))).toBe('gate-state');
  });

  it('loads nothing native: React is its one import at run time', () => {
    const source = read('src/styles/edges/ShellEdgeScreen.tsx');
    const runtime = [...source.matchAll(/^import (?!type )[^;]*from '([^']+)'/gm)].map(
      (match) => match[1],
    );
    expect(runtime).toEqual(['react']);
    expect(source).toContain("import type { GateEdgeProps } from '../../app-state/AppGate';");
  });
});

describe('the wiring (read from the source)', () => {
  it('the root layout hands GateEdge to the slot around the screens', () => {
    const root = read('app/_layout.tsx');
    expect(root).toContain("import { GateEdge } from '../src/styles/edges/GateEdge';");
    const opens = root.indexOf('<EdgeScreenSlot edge={GateEdge}>');
    expect(opens).toBeGreaterThan(root.indexOf('<AuthRoot>'));
    expect(root.indexOf('<Stack')).toBeGreaterThan(opens);
    expect(root.indexOf('</EdgeScreenSlot>')).toBeGreaterThan(root.indexOf('<Stack'));
  });

  it('the signed-in layout gives the gate ShellEdgeScreen, and imports no edge screen itself', () => {
    const layout = read('app/(app)/_layout.tsx');
    expect(layout).toContain(
      "import { ShellEdgeScreen } from '../../src/styles/edges/ShellEdgeScreen';",
    );
    expect(layout).toContain(
      '<AppGate consent={<ConsentSheet />} bar={NetworkBar} edge={ShellEdgeScreen}>',
    );
    const edgeImports = [...layout.matchAll(/from '\.\.\/\.\.\/src\/styles\/edges\/([^']+)'/g)];
    expect(edgeImports.map((match) => match[1])).toEqual(['ShellEdgeScreen']);
  });

  it('GateEdge: Not running for an own server asleep, else EdgeScreen over the fallback', () => {
    const edge = read('src/styles/edges/GateEdge.tsx');
    expect(edge).toContain("if (view.kind === 'not_running') {");
    expect(edge).toContain('<NotRunning');
    expect(edge).toContain('<EdgeScreen');
    expect(edge).toContain('otherwise={fallback}');
    expect(edge).toContain('quietRecheck(');
  });
});
