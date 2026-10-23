// Config plugin: Sentry uploads source maps and debug symbols only when the build env has
// SENTRY_AUTH_TOKEN. The @sentry/react-native plugin routes the iOS "Bundle React Native code
// and images" phase through sentry-xcode.sh, which fails the build when sentry-cli cannot
// upload, unless SENTRY_DISABLE_AUTO_UPLOAD=true; on Android its sentry.gradle adds upload
// tasks after every bundle task. The repository holds no Sentry token (D-NO-SECRETS), so a
// build without one must still succeed. docs/native-modules.md 'Sentry source maps'.

const fs = require('node:fs');
const path = require('node:path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const MARKER = 'automatos-go sentry-upload-guard';

// ios/.xcode.env is sourced (through with-environment.sh) by both build phases Sentry adds to.
const XCODE_ENV_GUARD = [
  `# ${MARKER}: no SENTRY_AUTH_TOKEN in the build env, no upload (docs/native-modules.md)`,
  'if [ -z "$SENTRY_AUTH_TOKEN" ]; then export SENTRY_DISABLE_AUTO_UPLOAD=true; fi',
].join('\n');

// sentry.gradle names each upload task '<bundle task>_SentryUpload_<release>_<versionCode>'.
const GRADLE_GUARD = [
  `// ${MARKER}: no SENTRY_AUTH_TOKEN in the build env, no upload (docs/native-modules.md)`,
  'gradle.taskGraph.whenReady { graph ->',
  "  if (!System.getenv('SENTRY_AUTH_TOKEN')) {",
  "    graph.allTasks.findAll { it.name.contains('_SentryUpload_') }.each { it.enabled = false }",
  '  }',
  '}',
].join('\n');

/** Appends `block` to a file's contents once; a second prebuild leaves it unchanged. */
function appendGuard(contents, block) {
  if (contents.includes(MARKER)) return contents;
  const base = contents === '' || contents.endsWith('\n') ? contents : `${contents}\n`;
  return `${base}\n${block}\n`;
}

const withXcodeEnvGuard = (config) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const file = path.join(modConfig.modRequest.platformProjectRoot, '.xcode.env');
      const contents = fs.existsSync(file) ? await fs.promises.readFile(file, 'utf8') : '';
      await fs.promises.writeFile(file, appendGuard(contents, XCODE_ENV_GUARD));
      return modConfig;
    },
  ]);

const withGradleGuard = (config) =>
  withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error('sentry-upload-guard: android/app/build.gradle must be Groovy.');
    }
    return {
      ...modConfig,
      modResults: {
        ...modConfig.modResults,
        contents: appendGuard(modConfig.modResults.contents, GRADLE_GUARD),
      },
    };
  });

const withSentryUploadGuard = (config) => withGradleGuard(withXcodeEnvGuard(config));

module.exports = withSentryUploadGuard;
module.exports.appendGuard = appendGuard;
module.exports.MARKER = MARKER;
module.exports.XCODE_ENV_GUARD = XCODE_ENV_GUARD;
module.exports.GRADLE_GUARD = GRADLE_GUARD;
