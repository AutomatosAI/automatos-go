import { describe, expect, it } from 'vitest';

import { JVM_ARGS, setJvmArgs } from '../with-gradle-memory';

type Item = { type: 'property'; key: string; value: string } | { type: 'comment'; value: string };

describe('setJvmArgs', () => {
  it("replaces the Expo template's jvmargs with the app's", () => {
    const items: Item[] = [
      { type: 'comment', value: 'Project-wide Gradle settings.' },
      { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m -XX:MaxMetaspaceSize=512m' },
      { type: 'property', key: 'newArchEnabled', value: 'true' },
    ];
    expect(setJvmArgs(items)).toEqual([
      { type: 'comment', value: 'Project-wide Gradle settings.' },
      { type: 'property', key: 'newArchEnabled', value: 'true' },
      { type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS },
    ]);
  });

  it('adds jvmargs when the file has none', () => {
    expect(setJvmArgs([])).toEqual([
      { type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS },
    ]);
  });

  it('leaves one jvmargs line when run twice', () => {
    const once = setJvmArgs([]);
    expect(setJvmArgs(once)).toEqual(once);
  });

  it('raises Metaspace above the 512 MB that failed the first build', () => {
    expect(JVM_ARGS).toMatch(/-XX:MaxMetaspaceSize=1536m/);
  });
});
