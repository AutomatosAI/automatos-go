// The step machine as the screen holds it: the snapshot, one event at a time, the listeners, and
// events a step does not take. The flows themselves are in sign-in-machine.test.ts.

import { describe, expect, it, vi } from 'vitest';

import { API_ERROR_COPY } from '../../api/strings';
import {
  createSignInMachine,
  INITIAL_SIGN_IN,
  transition,
  type SignInEvent,
  type SignInState,
} from '../sign-in-machine';
import { EMAIL, fakeClerk, PASSWORD } from './fake-sign-in';

describe('the sign-in machine: the store the screen holds', () => {
  it('starts on the choice, with nothing typed', () => {
    expect(createSignInMachine(() => fakeClerk()).getSnapshot()).toEqual({
      state: INITIAL_SIGN_IN,
      busy: false,
    });
  });

  it('an event the step does not take changes nothing and calls nothing', async () => {
    const port = fakeClerk();
    const ignored: readonly SignInEvent[] = [
      { type: 'verifyCode', code: '123456' },
      { type: 'resendCode' },
      { type: 'submitPassword', password: 'x' },
    ];
    for (const event of ignored) {
      expect(await transition(port, INITIAL_SIGN_IN, event)).toBe(INITIAL_SIGN_IN);
    }
    const complete: SignInState = { step: 'complete' };
    expect(await transition(port, complete, { type: 'usePasskey' })).toBe(complete);
    const password: SignInState = { step: 'password', identifier: EMAIL };
    expect(await transition(port, password, { type: 'verifyCode', code: '1' })).toBe(password);
    expect(port.password).not.toHaveBeenCalled();
    expect(port.emailCode.verifyCode).not.toHaveBeenCalled();
    expect(port.finalize).not.toHaveBeenCalled();
  });

  it('drops a second event while one runs (a double tap signs in once)', async () => {
    const port = fakeClerk();
    const machine = createSignInMachine(() => port);
    await machine.send(PASSWORD[0]);
    const first = machine.send(PASSWORD[1]);
    expect(machine.getSnapshot().busy).toBe(true);
    await machine.send(PASSWORD[1]);
    await first;
    expect(port.password).toHaveBeenCalledTimes(1);
    expect(machine.getSnapshot()).toEqual({ state: { step: 'complete' }, busy: false });
  });

  it('a failure outside Clerk ends in the error step and is never left busy', async () => {
    const machine = createSignInMachine(() => {
      throw new Error('signIn is not ready');
    });
    await machine.send({ type: 'usePasskey' });
    expect(machine.getSnapshot()).toEqual({
      state: { step: 'error', identifier: '', message: API_ERROR_COPY.server },
      busy: false,
    });
  });

  it('a listener that unsubscribes hears nothing more', async () => {
    const machine = createSignInMachine(() => fakeClerk());
    const listener = vi.fn();
    const unsubscribe = machine.subscribe(listener);
    await machine.send(PASSWORD[0]);
    unsubscribe();
    await machine.send({ type: 'startOver' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
