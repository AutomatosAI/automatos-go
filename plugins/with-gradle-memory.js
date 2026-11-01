// Config plugin: gives a local Android Gradle build enough memory for this app's native modules.
// The Expo template writes org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m, and a release
// build of this app runs out of Metaspace in lint (lintVitalAnalyzeRelease) and KSP
// (expo-updates:kspReleaseKotlin): the Android spike's first build failed there
// (docs/android-spike.md). expo-build-properties has no jvmargs option, so this sets the heap and
// Metaspace flags on the gradle.properties line and keeps any other flag on it.
//
// EAS ignores this: its Android workers pass their own org.gradle.jvmargs (-XX:MaxMetaspaceSize=1g,
// -Xmx 4g on medium or 8g on large), which override gradle.properties. To change memory on EAS, set
// GRADLE_OPTS in the build profile's env (docs/native-modules.md 'Gradle memory').

const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'org.gradle.jvmargs';
const MEMORY_FLAGS = ['-Xmx4096m', '-XX:MaxMetaspaceSize=1536m', '-XX:+HeapDumpOnOutOfMemoryError'];
// The flags this plugin owns: any value of these is replaced, every other flag is kept.
const OWNED = [/^-Xmx/, /^-XX:MaxMetaspaceSize=/, /^-XX:\+HeapDumpOnOutOfMemoryError$/];

/** Returns the jvmargs value with this plugin's memory flags and every other flag kept. */
function mergeJvmArgs(current) {
  const kept = (current ?? '')
    .split(/\s+/)
    .filter((flag) => flag !== '' && !OWNED.some((owned) => owned.test(flag)));
  return [...MEMORY_FLAGS, ...kept].join(' ');
}

/** Returns gradle.properties items with org.gradle.jvmargs merged, as one line, in place. */
function setJvmArgs(items) {
  const index = items.findIndex((item) => item.type === 'property' && item.key === KEY);
  if (index === -1) return [...items, { type: 'property', key: KEY, value: mergeJvmArgs('') }];
  return items.map((item, i) =>
    i === index ? { ...item, value: mergeJvmArgs(item.value) } : item,
  );
}

const withGradleMemory = (config) =>
  withGradleProperties(config, (modConfig) => ({
    ...modConfig,
    modResults: setJvmArgs(modConfig.modResults),
  }));

module.exports = withGradleMemory;
module.exports.setJvmArgs = setJvmArgs;
module.exports.mergeJvmArgs = mergeJvmArgs;
module.exports.MEMORY_FLAGS = MEMORY_FLAGS;
