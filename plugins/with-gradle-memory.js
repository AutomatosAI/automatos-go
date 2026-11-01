// Config plugin: gives the Android Gradle daemon enough memory for this app's native modules.
// The Expo template writes org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m, and a
// release build of this app runs out of Metaspace in lint (lintVitalAnalyzeRelease) and KSP
// (expo-updates:kspReleaseKotlin): the Android spike's first build failed there (spike notes,
// docs/android-spike.md). expo-build-properties has no jvmargs option, so this sets it.

const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'org.gradle.jvmargs';
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1536m -XX:+HeapDumpOnOutOfMemoryError';

/** Returns gradle.properties items with org.gradle.jvmargs set to JVM_ARGS, exactly once. */
function setJvmArgs(items) {
  const rest = items.filter((item) => !(item.type === 'property' && item.key === KEY));
  return [...rest, { type: 'property', key: KEY, value: JVM_ARGS }];
}

const withGradleMemory = (config) =>
  withGradleProperties(config, (modConfig) => ({
    ...modConfig,
    modResults: setJvmArgs(modConfig.modResults),
  }));

module.exports = withGradleMemory;
module.exports.setJvmArgs = setJvmArgs;
module.exports.JVM_ARGS = JVM_ARGS;
