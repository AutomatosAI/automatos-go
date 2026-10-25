// The device's SHA-256: expo-crypto's native digest. The ONLY file of the push wave that imports
// expo-crypto; everything else takes a Sha256 port, so vitest runs the signature check in node
// with node:crypto, and no test imports this file.

import { CryptoDigestAlgorithm, digest } from 'expo-crypto';

import type { Sha256 } from './hmac';

export const sha256Native: Sha256 = async (bytes) =>
  new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(bytes)));
