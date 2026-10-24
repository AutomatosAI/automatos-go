// Play's Companion components (Ember 01-03, US-017c): what Play's chat, its conversations and its
// bottom bar are drawn with. They take plain props (and the app's one needs-you number); phase 2
// (US-016k, US-017g) feeds them A2's thread and history and mounts them.

export { AutoRow, type AutoRowProps } from './AutoRow';
export { AutoMessage, PlayThreadCaption, UserMessage } from './Messages';
export type { AutoMessageProps, PlayMessageProps } from './Messages';
export { PlayBottomBar, type PlayBottomBarProps } from './PlayBottomBar';
export { PlayComposer, type PlayComposerProps } from './PlayComposer';
export { PlayConversations, type PlayConversationsProps } from './PlayConversations';
export { PlayHeader, type PlayHeaderProps } from './PlayHeader';
export { ReportCard, type ReportCardProps } from './ReportCard';
export { ReceiptsLine, ToolChip, type ReceiptsLineProps, type ToolChipProps } from './ToolChip';
export * from './model';
