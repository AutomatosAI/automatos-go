// Config plugin: app.json's ios.infoPlist.UIBackgroundModes is the whole list (K11:
// ['remote-notification'], no 'audio' per D33). Plugins that Expo prebuild applies on its own
// can add more: expo-task-manager is auto-applied and adds 'fetch', which the app does not use
// (expo-notifications' background task checks only 'remote-notification'). So the final
// Info.plist is reset to the declared list. docs/native-modules.md 'Background modes'.

const { withInfoPlist } = require('expo/config-plugins');

/** Returns a copy of the Info.plist whose UIBackgroundModes is exactly `declared`. */
function pinBackgroundModes(infoPlist, declared) {
  const { UIBackgroundModes: _added, ...rest } = infoPlist;
  return declared.length === 0 ? rest : { ...rest, UIBackgroundModes: [...declared] };
}

/** The list app.json declares; anything but an array of strings is a config error. */
function declaredBackgroundModes(config) {
  const declared = config.ios?.infoPlist?.UIBackgroundModes ?? [];
  if (!Array.isArray(declared) || !declared.every((mode) => typeof mode === 'string')) {
    throw new Error('app.json ios.infoPlist.UIBackgroundModes must be an array of strings.');
  }
  return declared;
}

const withPinnedBackgroundModes = (config) => {
  const declared = declaredBackgroundModes(config);
  return withInfoPlist(config, (modConfig) => ({
    ...modConfig,
    modResults: pinBackgroundModes(modConfig.modResults, declared),
  }));
};

module.exports = withPinnedBackgroundModes;
module.exports.pinBackgroundModes = pinBackgroundModes;
module.exports.declaredBackgroundModes = declaredBackgroundModes;
