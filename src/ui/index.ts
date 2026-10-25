// The primitives every layout shares (PRD-001 §4.3, K5): the chat (A2) and Command Centre (A3)
// waves import from here and never write a second Button. One component per file; their logic is
// in variants.ts (pure, tested).

export { Button, type ButtonProps } from './Button';
export { Card, type CardHeader, type CardProps } from './Card';
export { Chip, type ChipProps } from './Chip';
export { CommandCentreButton, type CommandCentreButtonProps } from './CommandCentreButton';
export { CountBadge, type CountBadgeProps } from './CountBadge';
export { Divider, type DividerProps } from './Divider';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { IconButton, type IconButtonProps } from './IconButton';
export { ListRow, type ListRowProps } from './ListRow';
export { LoadingState, type LoadingStateProps } from './LoadingState';
export { Pill, type PillProps } from './Pill';
export { ReportSheet, type ReportSheetProps } from './ReportSheet';
export { Screen, type ScreenProps } from './Screen';
export { Sheet, type SheetProps } from './Sheet';
export {
  SegmentedControl,
  type SegmentOption,
  type SegmentedControlProps,
} from './SegmentedControl';
export { Slider, type SliderProps } from './Slider';
export { StatusPip, type StatusPipProps } from './StatusPip';
export { Text, type TextProps } from './Text';
export { TextField, type TextFieldProps } from './TextField';
export { Toast, type ToastProps } from './Toast';
export { ToastProvider, type ToastProviderProps, useToast, type ToastApi } from './ToastProvider';
export { REPORT_COPY, REPORT_REASON_CHOICES, UI_COPY, type ReportReasonChoice } from './strings';
export { canReport } from './report';
export { TOAST_DURATION_MS, toastPlacement, type ToastPlacement } from './overlay';
export {
  PIP_TOKENS,
  COMMAND_CENTRE_BUTTON,
  badgeText,
  commandCentreLabel,
  countPhrase,
  errorCopy,
  pluralForm,
  statusPip,
  type ButtonSize,
  type ButtonVariant,
  type IconButtonSize,
  type PipStatus,
  type PluralForms,
  type TextLevel,
  type TextTone,
  type TextVariant,
  type Tone,
} from './variants';
