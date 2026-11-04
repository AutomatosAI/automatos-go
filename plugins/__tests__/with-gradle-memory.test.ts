import { describe, expect, it } from 'vitest';

import { MEMORY_FLAGS, mergeJvmArgs, setJvmArgs } from '../with-gradle-memory';

type Item = { type: 'property'; key: string; value: string } | { type: 'comment'; value: string };

const OURS = MEMORY_FLAGS.join(' ');

describe('mergeJvmArgs', () => {
  it("replaces the Expo template's heap and Metaspace", () => {
    expect(mergeJvmArgs('-Xmx2048m -XX:MaxMetaspaceSize=512m')).toBe(OURS);
  });

  it('keeps every flag it does not own', () => {
    expect(mergeJvmArgs('-Xmx2048m -Dfile.encoding=UTF-8 -XX:+UseParallelGC')).toBe(
      `${OURS} -Dfile.encoding=UTF-8 -XX:+UseParallelGC`,
    );
  });

  it('gives the same line when run twice', () => {
    expect(mergeJvmArgs(mergeJvmArgs('-Xmx2048m -Dfile.encoding=UTF-8'))).toBe(
      `${OURS} -Dfile.encoding=UTF-8`,
    );
  });

  it('raises Metaspace above the 512 MB that failed the first build', () => {
    expect(OURS).toContain('-XX:MaxMetaspaceSize=1536m');
  });
});

describe('setJvmArgs', () => {
  it('rewrites the jvmargs line where it is', () => {
    const items: Item[] = [
      { type: 'comment', value: 'Project-wide Gradle settings.' },
      { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m -XX:MaxMetaspaceSize=512m' },
      { type: 'property', key: 'newArchEnabled', value: 'true' },
    ];
    expect(setJvmArgs(items)).toEqual([
      { type: 'comment', value: 'Project-wide Gradle settings.' },
      { type: 'property', key: 'org.gradle.jvmargs', value: OURS },
      { type: 'property', key: 'newArchEnabled', value: 'true' },
    ]);
  });

  it('adds jvmargs when the file has none', () => {
    expect(setJvmArgs([])).toEqual([{ type: 'property', key: 'org.gradle.jvmargs', value: OURS }]);
  });

  it('leaves one jvmargs line when run twice', () => {
    const once = setJvmArgs([]);
    expect(setJvmArgs(once)).toEqual(once);
  });
});
