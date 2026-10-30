// client-facts.ts's ports bound to the app (only wiring; no test imports this file: the tests pass
// fakes). Read-only getters from push and voice, none of them changed here:
//   push: the session's registrar's last answer (src/push/settings/phone-link.ts phoneLinks; never
//     run from here) through the Notifications screen's own status (view-model.ts phoneStatusOf:
//     the server's gates, then that answer);
//   the microphone and speech recognition: permissions.check, which reads and never prompts;
//   the recognizer's policy for the language hold to talk listens in ("I speak");
//   the server voice: discovery's tts, then voice's one cache of the server's voices.

import type { ApiClient } from '../api/client';
import { canServerVoice } from '../api/capabilities';
import type { Discovery } from '../api/discovery';
import { readDeviceFacts } from '../push/registration/device-facts';
import { phoneLinks } from '../push/settings/phone-link';
import { phoneStatusOf } from '../push/settings/view-model';
import { listeningLocale } from '../voice/language/speak-language';
import { permissions } from '../voice/permissions/permissions';
import { phoneLocale } from '../voice/quick-ask/locale';
import { recognizer } from '../voice/quick-ask/recognizer';
import { serverVoices } from '../voice/server/use-server-voices';
import type { VoiceSetting } from '../voice/settings/voice-setting';
import type { ClientPorts } from './client-facts';

export type ClientPortsInput = Readonly<{
  discovery: Discovery;
  client: ApiClient;
  /** The voice setting as the screen holds it (useVoiceSetting): I speak and the voice chosen. */
  setting: VoiceSetting;
}>;

export function clientPorts({ discovery, client, setting }: ClientPortsInput): ClientPorts {
  return Object.freeze({
    pushStatus: () =>
      phoneStatusOf({
        discovery,
        projectId: readDeviceFacts().projectId,
        outcome: phoneLinks.current()?.registrar.latest() ?? null,
        outcomeAt: 0,
        devices: null,
        devicesAt: 0,
      }),
    checkPermission: permissions.check,
    recognitionPolicy: recognizer.policy,
    listeningLocale: () => listeningLocale(setting, phoneLocale()),
    voiceSource: () => setting.source,
    serverVoices: canServerVoice(discovery)
      ? async (fresh: boolean) => (await serverVoices.get(client, fresh)) !== null
      : null,
  });
}
