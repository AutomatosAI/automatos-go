import { describe, expect, it } from 'vitest';

import { SERVER_MESSAGE_MAX_CHARS } from '../../api/config';
import { ApiError, APP_ERROR_CODES, errorFromResponse } from '../../api/errors';
import { API_ERROR_COPY, APP_ERROR_COPY, WORKSPACE_COPY } from '../../api/strings';
import { WORKSPACE_PAUSED_DETAIL } from '../../api/workspace';
import { clerkCode, clerkWords, serverWords } from '../server-words';

/** automatos-ai core/auth/hybrid.py:855-862 at the pin, with a token in it as the server sends. */
const PENDING_INVITATION_BODY = JSON.stringify({
  detail: {
    code: 'pending_invitation',
    redirect: '/accept-invitation?token=inv_0123456789',
    token: 'inv_0123456789',
    message: 'Accept your pending invitation before continuing.',
  },
});

/** core/auth/user_link.py:33-36 LINK_CONFLICT_MESSAGE, raised as a 409 with a string detail. */
const LINK_CONFLICT_MESSAGE =
  'This sign-in matches an existing account that is not linked to it. Contact Automatos support.';

/** The shape @clerk/shared's ClerkAPIResponseError carries: no words of its own, errors[] has them. */
function clerkResponseError(entries: readonly Record<string, unknown>[]) {
  return Object.assign(new Error('api_response_error'), {
    clerkError: true,
    code: 'api_response_error',
    status: 422,
    errors: entries,
  });
}

/** A ClerkRuntimeError: a developer message and a code, never words for the user. */
function clerkRuntimeError(code: string, message: string) {
  return Object.assign(new Error(message), { clerkError: true, code });
}

describe("server words: Automatos's refusals of the first authenticated call", () => {
  it('a 409 pending_invitation shows the message from hybrid.py exactly as sent', () => {
    const error = errorFromResponse(409, PENDING_INVITATION_BODY);
    expect(error.kind).toBe('conflict');
    expect(error.code).toBe('pending_invitation');
    expect(serverWords(error)).toBe('Accept your pending invitation before continuing.');
  });

  it('never shows the invitation token or the redirect path', () => {
    const words = serverWords(errorFromResponse(409, PENDING_INVITATION_BODY));
    expect(words).not.toContain('inv_0123456789');
    expect(words).not.toContain('/accept-invitation');
  });

  it('the unlinked-account 409 (a string detail) is shown verbatim', () => {
    const error = errorFromResponse(409, JSON.stringify({ detail: LINK_CONFLICT_MESSAGE }));
    expect(serverWords(error)).toBe(LINK_CONFLICT_MESSAGE);
  });

  it('any other 409 with a detail.message is shown verbatim', () => {
    const body = JSON.stringify({
      detail: { code: 'waitlisted', message: "You're on the waitlist. We'll email you." },
    });
    expect(serverWords(errorFromResponse(409, body))).toBe(
      "You're on the waitlist. We'll email you.",
    );
  });

  it('a 403 with words is shown verbatim', () => {
    const body = JSON.stringify({ detail: 'Your account is waiting for approval.' });
    expect(serverWords(errorFromResponse(403, body))).toBe('Your account is waiting for approval.');
  });

  it("a paused workspace's 403 shows the D8 copy, not the server's administrator words", () => {
    const error = errorFromResponse(403, JSON.stringify({ detail: WORKSPACE_PAUSED_DETAIL }));
    expect(serverWords(error)).toBe(WORKSPACE_COPY.paused);
  });

  it('a 409 or 403 without words falls back to the taxonomy copy', () => {
    expect(serverWords(errorFromResponse(409, ''))).toBe(API_ERROR_COPY.conflict);
    expect(serverWords(errorFromResponse(403, '<html>Forbidden</html>'))).toBe(
      API_ERROR_COPY.forbidden,
    );
  });

  it("other statuses keep the taxonomy copy, even with the server's words in the body", () => {
    const unresolved = JSON.stringify({
      detail: 'Workspace not resolved. Ensure client sends X-Workspace-ID or user has a workspace.',
    });
    expect(serverWords(errorFromResponse(400, unresolved))).toBe(API_ERROR_COPY.server);
    const expired = JSON.stringify({ detail: 'Invalid or expired token' });
    expect(serverWords(errorFromResponse(401, expired))).toBe(API_ERROR_COPY.auth);
    expect(serverWords(new ApiError('network'))).toBe(API_ERROR_COPY.network);
  });

  it("an error the app raised with its own code keeps that code's words", () => {
    const error = new ApiError('auth', { code: APP_ERROR_CODES.signInNotSetUp });
    expect(serverWords(error)).toBe(APP_ERROR_COPY.signInNotSetUp);
  });
});

describe("server words: Clerk's refusals", () => {
  it("a ClerkAPIResponseError shows its first entry's longMessage", () => {
    const error = clerkResponseError([
      {
        code: 'form_identifier_not_found',
        message: 'not found',
        longMessage: "Couldn't find your account.",
      },
    ]);
    expect(serverWords(error)).toBe("Couldn't find your account.");
  });

  it('skips entries without words for the first that has them', () => {
    const error = clerkResponseError([
      { code: 'form_param_missing', message: 'is missing' },
      { code: 'form_code_incorrect', message: 'is incorrect', longMessage: 'Incorrect code' },
    ]);
    expect(serverWords(error)).toBe('Incorrect code');
  });

  it('a single ClerkAPIError (or a ClerkError with words) shows its own longMessage', () => {
    const error = {
      code: 'form_password_incorrect',
      message: 'is incorrect',
      longMessage: 'Password is incorrect. Try again, or use another method.',
    };
    expect(serverWords(error)).toBe('Password is incorrect. Try again, or use another method.');
  });

  it("never shows a Clerk error's developer message", () => {
    const error = clerkRuntimeError(
      'factor_not_found',
      'Clerk: Email code factor not found (code="factor_not_found")',
    );
    expect(serverWords(error)).toBe(API_ERROR_COPY.server);
    expect(clerkWords(clerkResponseError([{ code: 'x', message: 'is invalid' }]))).toBeUndefined();
  });

  it('a blank longMessage is no words at all', () => {
    expect(clerkWords({ longMessage: '   ' })).toBeUndefined();
  });

  it('Clerk unreachable (network_error, clerk_offline) shows the network copy', () => {
    expect(serverWords(clerkRuntimeError('network_error', 'Network request failed'))).toBe(
      API_ERROR_COPY.network,
    );
    expect(serverWords(clerkRuntimeError('clerk_offline', 'offline'))).toBe(API_ERROR_COPY.network);
  });

  it('cuts very long words to the same limit as the server messages', () => {
    const words = clerkWords({ longMessage: 'x'.repeat(SERVER_MESSAGE_MAX_CHARS + 50) });
    expect(words).toHaveLength(SERVER_MESSAGE_MAX_CHARS);
  });

  it("reads Clerk's code from the first entry, else from the error itself", () => {
    expect(clerkCode(clerkResponseError([{ code: 'form_code_incorrect' }]))).toBe(
      'form_code_incorrect',
    );
    expect(clerkCode(clerkRuntimeError('passkey_registration_cancelled', 'x'))).toBe(
      'passkey_registration_cancelled',
    );
    expect(clerkCode(new Error('plain'))).toBeUndefined();
  });
});

describe('server words: unknown shapes', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'Sign-in failed'],
    ['an empty object', {}],
    ['a plain Error', new Error('TypeError: undefined is not a function')],
    ['errors that are not a list', { errors: 'nope' }],
  ])('%s falls back to the taxonomy copy', (_label, error) => {
    expect(serverWords(error)).toBe(API_ERROR_COPY.server);
  });
});
