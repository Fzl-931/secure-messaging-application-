export interface UserProfile {
  id: string; // unique username, e.g. 'alice', 'bob'
  displayName: string;
  role: string;
  avatarColor: string;
  salt: string; // Base64 salt for PBKDF2
  passwordHash: string; // Base64 derived verification hash
  encryptedKeyVault: string; // Base64 JSON of encrypted ECDH & ECDSA private keys
  vaultIv: string; // Base64 IV used for vault encryption
  publicEcdhJwk: JsonWebKey; // Public key for ECDH key agreement
  publicEcdsaJwk: JsonWebKey; // Public key for ECDSA signature verification
  createdAt: string;
}

export interface UnlockedKeyVault {
  ecdhPrivateKey: CryptoKey;
  ecdhPublicKey: CryptoKey;
  ecdsaPrivateKey: CryptoKey;
  ecdsaPublicKey: CryptoKey;
}

export interface EncryptedPayload {
  id: string;
  senderId: string;
  recipientId: string;
  timestamp: string;
  ciphertext: string; // Base64
  iv: string; // Base64 (12 bytes)
  authTag: string; // Base64 (16 bytes AES-GCM tag, extracted or verified)
  signature: string; // Base64 ECDSA signature over (iv + ciphertext + recipientId + timestamp)
  senderPublicEcdhJwk: JsonWebKey;
  senderPublicEcdsaJwk: JsonWebKey;
  ratchetSeq: number;
  tamperedByMitm?: boolean;
}

export interface DecryptedMessage {
  id: string;
  senderId: string;
  recipientId: string;
  timestamp: string;
  plaintext?: string;
  rawPayload: EncryptedPayload;
  integrityStatus: 'valid' | 'tampered' | 'error';
  integrityDetails: {
    signatureValid: boolean;
    aeadTagValid: boolean;
    errorMessage?: string;
    computedKeyFingerprint?: string;
    verificationDurationMs?: number;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operation: 'KEYGEN' | 'PBKDF2' | 'ECDH_AGREE' | 'HKDF_DERIVE' | 'AES_GCM_ENCRYPT' | 'AES_GCM_DECRYPT' | 'ECDSA_SIGN' | 'ECDSA_VERIFY' | 'VAULT_UNLOCK' | 'TAMPER_DETECTED';
  actor: string;
  description: string;
  durationMs: number;
  status: 'SUCCESS' | 'INTEGRITY_FAIL' | 'ERROR';
  technicalDetails?: Record<string, unknown>;
}

export interface SafetyNumberInfo {
  combinedSafetyNumber: string; // 12-block formatted string (e.g. 54219 09214 ...)
  fingerprintA: string;
  fingerprintB: string;
  isVerified: boolean;
  verifiedAt?: string;
}
