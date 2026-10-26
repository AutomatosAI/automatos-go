# Export compliance: Automatos Go (OT-R13)

Apple asks every app that is distributed whether it uses encryption, under US export rules (the
Export Administration Regulations, Category 5 Part 2). Automatos Go answers in the build:
`app.json` sets `expo.ios.infoPlist.ITSAppUsesNonExemptEncryption` to `false`. With the key in the
build, App Store Connect does not hold each build for the encryption question
([testflight.md](testflight.md)). Requirement R22 and owner step OT-R13 are in
[README.md](README.md).

Proof: `src/release/__tests__/release-config.test.ts` (US-021o) pins the key at `false`.
[src/release/\_\_tests\_\_/release-docs.test.ts](../../src/release/__tests__/release-docs.test.ts)
checks that this page states the value `app.json` has.

## The answer

```text
ITSAppUsesNonExemptEncryption: false
```

## Why: every use of cryptography in the app (26 Oct)

The critique (critic-store-policy, "Export compliance") gave the reason as only TLS, the OS
keychain and WebRTC's standard DTLS/SRTP. The merged app also has two more uses, both of standard
algorithms: the encrypted cache (AES-256) and the push signature check (HMAC-SHA256). No
algorithm is proprietary or the app's own invention. None is offered to the person as a feature:
each one protects the app's own connections, sign-in, cache or notifications.

| Use | Where | Algorithm | Whose code | What it protects |
|---|---|---|---|---|
| HTTPS to the connected server, Clerk, Sentry and Expo | `src/api/transport.ts` (`expo/fetch`), the SDKs' own requests | TLS | The OS's networking | Every connection the app makes |
| The keychain | `expo-secure-store`, keys listed in `src/storage/secure-registry.ts` | The OS's keychain | iOS | The session, the cache's key, the install ID |
| The encrypted cache | `react-native-mmkv` 4.3.2, `encryptionType: 'AES-256'` (`src/storage/mmkv.ts`, `src/storage/encrypted-storage.ts`) | AES-256 | MMKVCore 2.4.0, a CocoaPod bundled in the binary | Recent screens kept on the phone |
| The push signature check | `src/push/signature/hmac.ts` over `expo-crypto`'s SHA-256 (`sha256-native.ts`) | HMAC-SHA256 (RFC 2104) | The app's own HMAC over the OS's SHA-256 | That a notification's action came from the server (authentication, not secrecy) |
| Random bytes | `expo-crypto` (`src/storage/mmkv.ts`, `src/connect/install-id.ts`) | The OS's random number generator | iOS | The cache's key, the install ID |
| Passkeys | Clerk's passkey sign-in, through the OS's passkey sheet | The OS's public-key authentication | iOS | Sign-in (authentication) |
| WebRTC | `@livekit/react-native-webrtc` 150.1.0 is installed, so `LiveKitWebRTC` is linked into the binary; no code calls it on 26 Oct (Auto Live, US-020, is not built) | DTLS-SRTP | WebRTC, bundled | Auto Live's call audio, once it ships |

MMKVCore and LiveKitWebRTC are CocoaPods fetched at build time, so their source is not in
`node_modules`. Whether MMKVCore's AES comes from its own code or the OS's was not read here.

## Open questions for Gerard

- **`[CHECK]` The US annual self-classification report** (critic-store-policy). Apple's export
  compliance page says an app that is exempt as mass market may still owe the US government a
  self-classification report each year. Nobody has decided who files it, for this app or for the
  academy app. The cache's AES-256 and WebRTC are standard encryption bundled in the app, not the
  OS's own, so this question applies to Automatos Go. Decide before the first App Store
  submission, with counsel if unsure.
- **If the encryption question changes.** A new use of cryptography, for example end-to-end
  encryption or a cryptographic library added by a dependency, means re-reading this table before
  the next native build. `ITSAppUsesNonExemptEncryption` stays `false` only while every row is a
  standard algorithm protecting the app's own data.

## Owner step (OT-R13)

Before the first App Store submission, decide who files the annual self-classification report (or
that none is owed), and confirm in App Store Connect that the build shows no export-compliance
question.
