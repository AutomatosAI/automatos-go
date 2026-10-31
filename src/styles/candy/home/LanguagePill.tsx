// A6's EN/PT switch in Candy (27 Oct 2026; HUD's and Arcade's homes draw it beside hold to talk): a
// header pill (HeaderPill) beside the pause control in a view's header, for someone who may talk.
// Its letters ('EN') are the saved "I speak"; VoiceOver hears the language and what a tap switches
// to.

import type { HudLanguage } from '../../hud/core/model';
import { HeaderPill } from './HeaderPill';

export function LanguagePill({ language }: { readonly language: HudLanguage }) {
  return <HeaderPill {...language} />;
}
