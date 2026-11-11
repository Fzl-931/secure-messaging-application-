/**
 * Web Crypto API primitives for AegisCrypt
 * Implements:
 * - PBKDF2-SHA256 for password hashing and client-side Key Vault encryption
 * - ECDH (NIST P-256) for Diffie-Hellman asymmetric key agreement
 * - HKDF (SHA-256) for deriving 256-bit symmetric session keys
 * - AES-256-GCM for Authenticated Encryption with Associated Data (AEAD)
 * - ECDSA (P-256 / SHA-256) for non-repudiation digital signatures
 * - Cryptographic Safety Numbers (Signal-style public key fingerprints)
 */

import { EncryptedPayload, UnlockedKeyVault } from '../types/crypto';

// --- Encoding Utilities ---

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export function generateRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(length);
  const bytes = new Uint8Array(buffer);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

// --- PBKDF2 Key Derivation & Vault Protection ---

export async function deriveKeyFromPassword(
  password: string,
  saltBuffer: ArrayBuffer
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function hashPasswordForAuth(
  password: string,
  saltBuffer: ArrayBuffer
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bufferToBase64(derivedBits);
}

// --- Asymmetric Key Pair Generation ---

export interface GeneratedKeyBundle {
  ecdhKeyPair: CryptoKeyPair;
  ecdsaKeyPair: CryptoKeyPair;
  publicEcdhJwk: JsonWebKey;
  publicEcdsaJwk: JsonWebKey;
  privateEcdhJwk: JsonWebKey;
  privateEcdsaJwk: JsonWebKey;
}

export async function generateIdentityKeyBundle(): Promise<GeneratedKeyBundle> {
  // 1. Generate ECDH P-256 key pair for Key Exchange
  const ecdhKeyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  // 2. Generate ECDSA P-256 key pair for Message Integrity & Signatures
  const ecdsaKeyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );

  // Export JWKs
  const publicEcdhJwk = await window.crypto.subtle.exportKey('jwk', ecdhKeyPair.publicKey);
  const privateEcdhJwk = await window.crypto.subtle.exportKey('jwk', ecdhKeyPair.privateKey);
  const publicEcdsaJwk = await window.crypto.subtle.exportKey('jwk', ecdsaKeyPair.publicKey);
  const privateEcdsaJwk = await window.crypto.subtle.exportKey('jwk', ecdsaKeyPair.privateKey);

  return {
    ecdhKeyPair,
    ecdsaKeyPair,
    publicEcdhJwk,
    publicEcdsaJwk,
    privateEcdhJwk,
    privateEcdsaJwk,
  };
}

// --- Encrypted Key Vault (Zero-Knowledge Private Key Storage) ---

export async function encryptKeyVault(
  privateEcdhJwk: JsonWebKey,
  privateEcdsaJwk: JsonWebKey,
  vaultKey: CryptoKey
): Promise<{ encryptedVault: string; iv: string }> {
  const vaultData = JSON.stringify({
    privateEcdhJwk,
    privateEcdsaJwk,
  });

  const iv = generateRandomBytes(12);
  const enc = new TextEncoder();
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    vaultKey,
    enc.encode(vaultData)
  );

  return {
    encryptedVault: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
  };
}

export async function decryptKeyVault(
  encryptedVaultBase64: string,
  ivBase64: string,
  vaultKey: CryptoKey,
  publicEcdhJwk: JsonWebKey,
  publicEcdsaJwk: JsonWebKey
): Promise<UnlockedKeyVault> {
  const encryptedBuffer = base64ToBuffer(encryptedVaultBase64);
  const ivBuffer = base64ToBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer) as unknown as BufferSource,
    },
    vaultKey,
    encryptedBuffer
  );

  const dec = new TextDecoder();
  const jsonStr = dec.decode(decryptedBuffer);
  const { privateEcdhJwk, privateEcdsaJwk } = JSON.parse(jsonStr);

  // Import keys into CryptoKey instances
  const ecdhPrivateKey = await window.crypto.subtle.importKey(
    'jwk',
    privateEcdhJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const ecdhPublicKey = await window.crypto.subtle.importKey(
    'jwk',
    publicEcdhJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  const ecdsaPrivateKey = await window.crypto.subtle.importKey(
    'jwk',
    privateEcdsaJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const ecdsaPublicKey = await window.crypto.subtle.importKey(
    'jwk',
    publicEcdsaJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  );

  return {
    ecdhPrivateKey,
    ecdhPublicKey,
    ecdsaPrivateKey,
    ecdsaPublicKey,
  };
}

// --- ECDH Key Agreement & HKDF Session Derivation ---

/**
 * Computes ECDH Shared Secret and derives an AES-256-GCM Session Key via HKDF
 */
export async function deriveSessionKey(
  myPrivateEcdh: CryptoKey,
  theirPublicEcdhJwk: JsonWebKey,
  contextSalt: string = 'AegisCrypt-Session-v1'
): Promise<{ sessionKey: CryptoKey; sharedSecretHex: string; keyFingerprint: string }> {
  // Import peer public key
  const peerPublicKey = await window.crypto.subtle.importKey(
    'jwk',
    theirPublicEcdhJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 1. Derive shared bits via ECDH agreement
  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: peerPublicKey,
    },
    myPrivateEcdh,
    256
  );

  const sharedSecretHex = bufferToHex(sharedBits);

  // 2. Import shared bits as HKDF key material
  const hkdfKey = await window.crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  // 3. Derive 256-bit AES-GCM session key
  const enc = new TextEncoder();
  const salt = enc.encode(contextSalt);
  const info = enc.encode('AegisCrypt-AES-256-GCM-Ratchet');

  const sessionKey = await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Derive short key fingerprint for visualization (first 8 hex bytes of SHA-256 of session key raw export)
  const exportedRaw = await window.crypto.subtle.exportKey('raw', sessionKey);
  const hash = await window.crypto.subtle.digest('SHA-256', exportedRaw);
  const keyFingerprint = bufferToHex(hash).substring(0, 16);

  return { sessionKey, sharedSecretHex, keyFingerprint };
}

// --- Message Encryption & Signing ---

export async function encryptAndSignMessage(
  sessionKey: CryptoKey,
  plaintext: string,
  senderPrivateEcdsa: CryptoKey,
  senderId: string,
  recipientId: string,
  senderPublicEcdhJwk: JsonWebKey,
  senderPublicEcdsaJwk: JsonWebKey,
  ratchetSeq: number = 0
): Promise<EncryptedPayload> {
  const enc = new TextEncoder();
  const iv = generateRandomBytes(12); // 96-bit unique IV recommended for AES-GCM
  const plaintextBuffer = enc.encode(plaintext);

  // Encrypt with AES-GCM (appends 16-byte authentication tag at the end)
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
    },
    sessionKey,
    plaintextBuffer
  );

  // Extract auth tag for explicit inspection
  const fullBytes = new Uint8Array(ciphertextBuffer);
  const tagStart = fullBytes.length - 16;
  const authTagBytes = fullBytes.slice(tagStart);

  const timestamp = new Date().toISOString();
  const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Construct message canonical transcript to sign with ECDSA:
  // (id + senderId + recipientId + timestamp + ivBase64 + ciphertextBase64 + seq)
  const ivBase64 = bufferToBase64(iv);
  const ciphertextBase64 = bufferToBase64(ciphertextBuffer);
  const authTagBase64 = bufferToBase64(authTagBytes);

  const signatureData = `${id}|${senderId}|${recipientId}|${timestamp}|${ivBase64}|${ciphertextBase64}|${ratchetSeq}`;
  const signatureBuffer = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    senderPrivateEcdsa,
    enc.encode(signatureData)
  );

  return {
    id,
    senderId,
    recipientId,
    timestamp,
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    authTag: authTagBase64,
    signature: bufferToBase64(signatureBuffer),
    senderPublicEcdhJwk,
    senderPublicEcdsaJwk,
    ratchetSeq,
  };
}

// --- Message Decryption & Integrity Verification ---

export interface DecryptionResult {
  plaintext?: string;
  signatureValid: boolean;
  aeadTagValid: boolean;
  integrityStatus: 'valid' | 'tampered' | 'error';
  errorMessage?: string;
  durationMs: number;
}

export async function verifyAndDecryptMessage(
  sessionKey: CryptoKey,
  payload: EncryptedPayload
): Promise<DecryptionResult> {
  const startTime = performance.now();
  const enc = new TextEncoder();

  let signatureValid = false;
  let aeadTagValid = false;

  try {
    // 1. Verify ECDSA Digital Signature first (Sender Authenticity & Non-Repudiation)
    const senderEcdsaPublicKey = await window.crypto.subtle.importKey(
      'jwk',
      payload.senderPublicEcdsaJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    const signatureData = `${payload.id}|${payload.senderId}|${payload.recipientId}|${payload.timestamp}|${payload.iv}|${payload.ciphertext}|${payload.ratchetSeq}`;
    const signatureBuffer = base64ToBuffer(payload.signature);

    signatureValid = await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      senderEcdsaPublicKey,
      signatureBuffer,
      enc.encode(signatureData)
    );

    // 2. Decrypt with AES-GCM (Verifies Authenticated Encryption Tag)
    const ivBuffer = base64ToBuffer(payload.iv);
    const ciphertextBuffer = base64ToBuffer(payload.ciphertext);

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(ivBuffer) as unknown as BufferSource,
          tagLength: 128,
        },
        sessionKey,
        ciphertextBuffer
      );

      aeadTagValid = true;
      const dec = new TextDecoder();
      const plaintext = dec.decode(decryptedBuffer);
      const durationMs = performance.now() - startTime;

      if (!signatureValid) {
        return {
          plaintext,
          signatureValid: false,
          aeadTagValid: true,
          integrityStatus: 'tampered',
          errorMessage: 'Sender ECDSA signature invalid! Potential MITM or impersonation detected.',
          durationMs,
        };
      }

      return {
        plaintext,
        signatureValid: true,
        aeadTagValid: true,
        integrityStatus: 'valid',
        durationMs,
      };
    } catch (decryptErr) {
      // AES-GCM decrypt throws an OperationError if the ciphertext, IV, or auth tag was altered by even 1 bit!
      aeadTagValid = false;
      const durationMs = performance.now() - startTime;
      return {
        signatureValid,
        aeadTagValid: false,
        integrityStatus: 'tampered',
        errorMessage: 'AEAD MAC Verification Failed: Ciphertext, IV, or Auth Tag was altered in transit! Web Crypto rejected payload.',
        durationMs,
      };
    }
  } catch (err: unknown) {
    const durationMs = performance.now() - startTime;
    return {
      signatureValid: false,
      aeadTagValid: false,
      integrityStatus: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown cryptographic error',
      durationMs,
    };
  }
}

// --- Signal-Style Safety Numbers (Fingerprint Comparison) ---

/**
 * Computes a standardized safety number from two users' ECDH public keys
 * Formatted into 12 groups of 5 digits (total 60 digits) or 6 groups of 5 digits
 */
export async function computeSafetyNumber(
  userA_EcdhJwk: JsonWebKey,
  userB_EcdhJwk: JsonWebKey,
  userA_Id: string,
  userB_Id: string
): Promise<{ safetyNumberFormatted: string; rawDigestHex: string }> {
  const enc = new TextEncoder();

  // Canonical ordering by ID so both Alice and Bob compute the exact same safety number
  const [firstId, secondId, firstJwk, secondJwk] =
    userA_Id < userB_Id
      ? [userA_Id, userB_Id, userA_EcdhJwk, userB_EcdhJwk]
      : [userB_Id, userA_Id, userB_EcdhJwk, userA_EcdhJwk];

  const canonicalPayload = JSON.stringify({
    firstId,
    firstX: firstJwk.x,
    firstY: firstJwk.y,
    secondId,
    secondX: secondJwk.x,
    secondY: secondJwk.y,
  });

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(canonicalPayload));
  const rawDigestHex = bufferToHex(hashBuffer);

  // Convert bytes into numeric chunks
  const bytes = new Uint8Array(hashBuffer);
  const chunks: string[] = [];

  for (let i = 0; i < 12; i++) {
    // Take 2 bytes and convert to a 5-digit number modulo 100,000
    const val = ((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % 100000;
    chunks.push(val.toString().padStart(5, '0'));
  }

  const safetyNumberFormatted = chunks.join(' ');
  return { safetyNumberFormatted, rawDigestHex };
}

// Compute individual key fingerprint
export async function computeKeyFingerprint(jwk: JsonWebKey): Promise<string> {
  const enc = new TextEncoder();
  const raw = `${jwk.crv || ''}:${jwk.x || ''}:${jwk.y || ''}`;
  const hash = await window.crypto.subtle.digest('SHA-256', enc.encode(raw));
  return bufferToHex(hash).substring(0, 32);
}
