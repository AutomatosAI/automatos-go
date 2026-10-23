// A block's words (OT-C8): one selectable Text in the block's role, each marked run a nested Text
// in the face look.ts picks for it. A link opens through the app's own link handling (links.ts,
// then the thread's onLink: an app screen, or the system browser, never a WebView); a link to
// another site first asks, showing its host and full address (a phone has no hover, and Auto's
// words can carry a link from something it read); a link with no safe place to open reads as plain
// words. Report this rides on the block as an accessible action.

import type { ReactNode } from 'react';
import { Alert, Text as NativeText, type StyleProp, type TextStyle } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import type { FontWeight } from '../../styles/fonts';
import { useTokens } from '../../styles/theme';
import type { Colours } from '../../styles/tokens';
import type { TypeRole, TypeScale } from '../../styles/type';
import { Text } from '../../ui';
import { textRole, type TextLevel, type TextTone, type TextVariant } from '../../ui/variants';
import type { ReportAccessibility } from '../report/report';
import { MARKDOWN_COPY } from '../strings';
import type { Span } from './inline';
import { markdownLink, type MarkdownLink } from './links';
import { spanStyle } from './look';

type RunContext = {
  readonly type: TypeScale;
  readonly colours: Colours;
  readonly role: TypeRole;
  /** The block's own weight (a minor heading's 600), kept by a run that is not bold. */
  readonly weight: FontWeight | undefined;
  readonly onLink: (target: WebLinkTarget) => void;
};

/** Opens a link: an app screen or Studio at once; another site once the reader has seen it. */
function follow(link: MarkdownLink, onLink: (target: WebLinkTarget) => void): void {
  const { site, target } = link;
  if (site === null) {
    onLink(target);
    return;
  }
  const copy = MARKDOWN_COPY.openSite;
  Alert.alert(copy.title(site.host), site.address, [
    { text: copy.cancel, style: 'cancel' },
    { text: copy.open, onPress: () => onLink(target) },
  ]);
}

/** Plain words as a string (they take the block's face); a marked run or a link, a nested Text. */
function run(span: Span, index: number, context: RunContext): ReactNode {
  if (span.kind === 'break') return '\n';
  const link = span.href === null ? null : markdownLink(span.href);
  const { type, colours, role, weight } = context;
  const style = spanStyle(type, colours, role, span.marks, link !== null, weight);
  if (style === null) return span.text;
  if (link === null) {
    return (
      <NativeText key={index} style={style}>
        {span.text}
      </NativeText>
    );
  }
  return (
    <NativeText
      key={index}
      style={style}
      accessibilityRole="link"
      accessibilityHint={link.site ? MARKDOWN_COPY.openSite.hint(link.site.host) : undefined}
      onPress={() => follow(link, context.onLink)}
    >
      {span.text}
    </NativeText>
  );
}

export type InlineTextProps = {
  readonly spans: readonly Span[];
  readonly variant?: TextVariant;
  readonly level?: TextLevel;
  readonly tone?: TextTone;
  /** The block's weight (a minor heading at 600); the role's own by default. */
  readonly weight?: FontWeight;
  /** A heading: screen readers hear it as one. */
  readonly header?: boolean;
  readonly style?: StyleProp<TextStyle>;
  readonly onLink: (target: WebLinkTarget) => void;
  readonly report: ReportAccessibility;
};

export function InlineText({
  spans,
  variant = 'body',
  level,
  tone,
  weight,
  header = false,
  style,
  onLink,
  report,
}: InlineTextProps) {
  const { type, colours } = useTokens();
  const context: RunContext = { type, colours, role: textRole(variant, level), weight, onLink };
  return (
    <Text
      variant={variant}
      level={level}
      tone={tone}
      weight={weight}
      style={style}
      selectable
      accessibilityRole={header ? 'header' : undefined}
      {...report}
    >
      {spans.map((span, index) => run(span, index, context))}
    </Text>
  );
}
