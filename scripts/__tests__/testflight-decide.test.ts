import { describe, expect, it } from 'vitest';

import { decide, parseCli } from '../testflight-decide';

const IDLE = {
  inProgress: false,
  lastFinishedId: 'build-1',
  fingerprintsIdentical: null,
  requested: 'auto',
} as const;

describe('decide', () => {
  it('waits while a testflight build is in progress, whatever was requested (D48)', () => {
    expect(decide({ ...IDLE, inProgress: true })).toBe('wait');
    expect(decide({ ...IDLE, inProgress: true, requested: 'build' })).toBe('wait');
    expect(decide({ ...IDLE, inProgress: true, requested: 'update' })).toBe('wait');
  });

  it('builds when no testflight build has finished yet', () => {
    expect(decide({ ...IDLE, lastFinishedId: null })).toBe('build');
  });

  it('ships an update when the fingerprints are identical', () => {
    expect(decide({ ...IDLE, fingerprintsIdentical: true })).toBe('update');
  });

  it('builds when the fingerprints differ', () => {
    expect(decide({ ...IDLE, fingerprintsIdentical: false })).toBe('build');
  });

  it('builds when the fingerprints were not compared', () => {
    expect(decide({ ...IDLE, fingerprintsIdentical: null })).toBe('build');
  });

  it('honours a requested update or build', () => {
    expect(decide({ ...IDLE, fingerprintsIdentical: false, requested: 'update' })).toBe('update');
    expect(decide({ ...IDLE, fingerprintsIdentical: true, requested: 'build' })).toBe('build');
    expect(decide({ ...IDLE, lastFinishedId: null, requested: 'update' })).toBe('update');
  });
});

describe('parseCli', () => {
  it('reads every flag', () => {
    expect(
      parseCli([
        '--in-progress',
        'false',
        '--last-finished-id',
        'abc',
        '--fingerprints-identical',
        'true',
        '--requested',
        'auto',
      ]),
    ).toEqual({
      inProgress: false,
      lastFinishedId: 'abc',
      fingerprintsIdentical: true,
      requested: 'auto',
    });
  });

  it('treats empty values as unknown and defaults to auto', () => {
    expect(
      parseCli(['--in-progress', 'true', '--last-finished-id', '', '--fingerprints-identical', '']),
    ).toEqual({
      inProgress: true,
      lastFinishedId: null,
      fingerprintsIdentical: null,
      requested: 'auto',
    });
  });

  it('rejects an unknown request', () => {
    expect(() => parseCli(['--requested', 'ship-it'])).toThrow(/auto, update, build/);
  });

  it('rejects a non-boolean flag value', () => {
    expect(() => parseCli(['--in-progress', 'yes'])).toThrow(/in-progress/);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseCli(['--force'])).toThrow();
  });
});
