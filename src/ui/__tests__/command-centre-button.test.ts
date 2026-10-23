import { describe, expect, it } from 'vitest';

import { STUDIO_TYPE } from '../../styles/type';
import { UI_COPY } from '../strings';
import {
  COMMAND_CENTRE_BUTTON,
  ICON_BUTTON_SIZES,
  commandCentreLabel,
  textRole,
} from '../variants';

describe('the Command Centre button (the header, K5)', () => {
  it('says the needs-you number to VoiceOver, as the badge inside cannot', () => {
    expect(commandCentreLabel(0)).toBe(UI_COPY.commandCentre);
    expect(commandCentreLabel(Number.NaN)).toBe('Command Centre');
    expect(commandCentreLabel(1)).toBe('Command Centre, 1 needs you');
    expect(commandCentreLabel(6)).toBe('Command Centre, 6 need you');
    // the badge shows 99+; VoiceOver hears the number itself
    expect(commandCentreLabel(120)).toBe('Command Centre, 120 need you');
  });

  it("is sized as the header's 36 pt buttons, with a 15 pt icon and a 12 pt label", () => {
    expect(COMMAND_CENTRE_BUTTON.height).toBe(ICON_BUTTON_SIZES.md.box);
    expect(COMMAND_CENTRE_BUTTON.iconSize).toBe(15);
    expect(STUDIO_TYPE[textRole('body', COMMAND_CENTRE_BUTTON.level)].fontSize).toBe(12);
  });
});
