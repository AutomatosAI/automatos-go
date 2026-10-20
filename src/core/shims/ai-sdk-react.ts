// Structural stand-in for `UIMessage` from '@ai-sdk/react' (ai v5), which the vendored
// types/chat.ts type-imports (scripts/core-manifest.json shims). The app never installs the
// AI SDK: it builds messages from the wire itself (src/core/turn-reducer.ts), so only the
// fields the vendored types read are declared here.
//
// ai v5 types `parts` as its own UIMessagePart union. The vendored ChatMessage is
// `UIMessage<MessageMetadata> & { parts: MessagePart[] }`; declaring `parts` as unknown
// keeps that intersection exactly `MessagePart[]` (unknown & T is T).
export interface UIMessage<METADATA = unknown> {
  id: string;
  role: 'system' | 'user' | 'assistant';
  metadata?: METADATA;
  parts?: unknown;
}
