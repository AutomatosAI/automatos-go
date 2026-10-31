// Candy's parts (US-023f, D-CAN-6, D-CAN-9): the gradient card, the orb, the band, the floating
// tab bar, pills and status chips, avatars and the writing chip. Props only; the home (US-023g..j)
// feeds them its counts, rows, agents and Deliverables, and the dress and edge screens (US-023k,
// US-023l) reuse the card and the band. Their colours and type come from the resolved style
// (use-candy-paint.ts) and tokens/candy-paint.ts.

export { Avatar, type AvatarProps } from './Avatar';
export { Band, type BandProps } from './Band';
export { CardFill, type CardFillProps } from './CardFill';
export { GradientCard, type GradientCardProps } from './GradientCard';
export { Orb, type OrbProps } from './Orb';
export { Pill, PillRow, type PillProps, type PillRowProps } from './Pill';
export { StatusChip, type StatusChipProps } from './StatusChip';
export { TabBar, type TabBarProps } from './TabBar';
export { WritingChip } from './WritingChip';
export * from './avatar-model';
export * from './chips';
export * from './orb-model';
export * from './shapes';
export * from './tab-bar';
export * from './writing';
export { useCandyPaint, type CandyPaint } from './use-candy-paint';
