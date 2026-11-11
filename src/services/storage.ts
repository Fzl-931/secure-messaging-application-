import {
  UserProfile,
  UnlockedKeyVault,
  EncryptedPayload,
  DecryptedMessage,
  SafetyNumberInfo,
} from '../types/crypto';
import {
  generateRandomBytes,
  bufferToBase64,
  base64ToBuffer,
  deriveKeyFromPassword,
  hashPasswordForAuth,
  generateIdentityKeyBundle,
  encryptKeyVault,
  decryptKeyVault,
  deriveSessionKey,
  encryptAndSignMessage,
  verifyAndDecryptMessage,
  computeSafetyNumber,
  computeKeyFingerprint,
} from '../crypto/webcrypto';
import { auditLogger } from '../crypto/auditLog';

const USERS_STORAGE_KEY = 'aegiscrypt_users_v2';
const MESSAGES_STORAGE_KEY = 'aegiscrypt_messages_v2';
const VERIFIED_KEYS_STORAGE_KEY = 'aegiscrypt_verified_keys_v2';
const ACTIVE_USER_KEY = 'aegiscrypt_active_user_v2';

// In-memory cache for decrypted session keys: `${userA}:${userB}` -> CryptoKey
const sessionKeyCache = new Map<string, CryptoKey>();
// In-memory cache for unlocked vaults
const unlockedVaultCache = new Map<string, UnlockedKeyVault>();

type MessageUpdateListener = () => void;
const messageListeners = new Set<MessageUpdateListener>();

// Cross-tab broadcast channel
let broadcastChannel: BroadcastChannel | null = null;
try {
  broadcastChannel = new BroadcastChannel('aegiscrypt_sync_bus');
  broadcastChannel.onmessage = (event) => {
    if (event.data?.type === 'NEW_MESSAGE' || event.data?.type === 'MESSAGE_TAMPERED') {
      messageListeners.forEach(listener => listener());
    }
  };
} catch {
  // BroadcastChannel might fail in some sandboxed iframes; fallback to window storage events
}

window.addEventListener('storage', (event) => {
  if (event.key === MESSAGES_STORAGE_KEY) {
    messageListeners.forEach(listener => listener());
  }
});

function notifyMessageSubscribers(): void {
  messageListeners.forEach(fn => fn());
  try {
    broadcastChannel?.postMessage({ type: 'NEW_MESSAGE', timestamp: Date.now() });
  } catch {
    // ignore
  }
}

export function subscribeToMessages(listener: MessageUpdateListener): () => void {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

// --- User Profile Management ---

export function getStoredUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredUsers(users: UserProfile[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

export function getUserById(userId: string): UserProfile | undefined {
  return getStoredUsers().find(u => u.id === userId);
}

// --- Initialize / Seed Demo Profiles ---

export async function initializeDatabase(): Promise<void> {
  const existingUsers = getStoredUsers();
  if (existingUsers.length > 0) {
    return;
  }

  const defaultUsers = [
    { id: 'alice', name: 'Alice Vance', role: 'Security Architect', color: 'indigo' },
    { id: 'bob', name: 'Bob Chen', role: 'Cryptographic Engineer', color: 'emerald' },
    { id: 'charlie', name: 'Charlie Davis', role: 'Threat Analyst', color: 'amber' },
  ];

  const createdUsers: UserProfile[] = [];

  for (const u of defaultUsers) {
    const saltBytes = generateRandomBytes(16);
    const saltBase64 = bufferToBase64(saltBytes);

    const t0 = performance.now();
    const vaultKey = await deriveKeyFromPassword('password123', saltBytes.buffer as ArrayBuffer);
    const passwordHash = await hashPasswordForAuth('password123', saltBytes.buffer as ArrayBuffer);
    const keyBundle = await generateIdentityKeyBundle();

    const { encryptedVault, iv } = await encryptKeyVault(
      keyBundle.privateEcdhJwk,
      keyBundle.privateEcdsaJwk,
      vaultKey
    );

    auditLogger.record(
      'KEYGEN',
      u.id,
      `Generated ECDH & ECDSA NIST P-256 keypairs and encrypted Key Vault using PBKDF2 (100k iters)`,
      performance.now() - t0,
      'SUCCESS'
    );

    createdUsers.push({
      id: u.id,
      displayName: u.name,
      role: u.role,
      avatarColor: u.color,
      salt: saltBase64,
      passwordHash,
      encryptedKeyVault: encryptedVault,
      vaultIv: iv,
      publicEcdhJwk: keyBundle.publicEcdhJwk,
      publicEcdsaJwk: keyBundle.publicEcdsaJwk,
      createdAt: new Date().toISOString(),
    });
  }

  saveStoredUsers(createdUsers);

  // Set Alice as initial active user
  localStorage.setItem(ACTIVE_USER_KEY, 'alice');

  // Automatically login Alice into in-memory vault for quick initial experience
  const alice = createdUsers[0];
  const aliceVaultKey = await deriveKeyFromPassword('password123', base64ToBuffer(alice.salt));
  const aliceVault = await decryptKeyVault(
    alice.encryptedKeyVault,
    alice.vaultIv,
    aliceVaultKey,
    alice.publicEcdhJwk,
    alice.publicEcdsaJwk
  );
  unlockedVaultCache.set('alice', aliceVault);

  // Automatically unlock Bob's vault in cache as well for seed message generation
  const bob = createdUsers[1];
  const bobVaultKey = await deriveKeyFromPassword('password123', base64ToBuffer(bob.salt));
  const bobVault = await decryptKeyVault(
    bob.encryptedKeyVault,
    bob.vaultIv,
    bobVaultKey,
    bob.publicEcdhJwk,
    bob.publicEcdsaJwk
  );
  unlockedVaultCache.set('bob', bobVault);

  // Derive initial session key between Alice and Bob
  const { sessionKey: aliceBobSessionKey } = await deriveSessionKey(
    aliceVault.ecdhPrivateKey,
    bob.publicEcdhJwk
  );
  const cacheKey = getSessionCacheKey('alice', 'bob');
  sessionKeyCache.set(cacheKey, aliceBobSessionKey);

  // Seed sample encrypted conversation
  const initialPayloads: EncryptedPayload[] = [];

  const msg1 = await encryptAndSignMessage(
    aliceBobSessionKey,
    'Welcome to AegisCrypt! Every message here is end-to-end encrypted using AES-256-GCM with ECDH P-256 key exchange.',
    aliceVault.ecdsaPrivateKey,
    'alice',
    'bob',
    alice.publicEcdhJwk,
    alice.publicEcdsaJwk,
    1
  );
  initialPayloads.push(msg1);

  const msg2 = await encryptAndSignMessage(
    aliceBobSessionKey,
    'Confirmed. My client verified your ECDSA P-256 digital signature and AEAD authentication tag. The shared secret matches.',
    bobVault.ecdsaPrivateKey,
    'bob',
    'alice',
    bob.publicEcdhJwk,
    bob.publicEcdsaJwk,
    2
  );
  initialPayloads.push(msg2);

  const msg3 = await encryptAndSignMessage(
    aliceBobSessionKey,
    'Try the "Tamper Lab" button on any message or toggle MITM simulation below to test AEAD integrity protection.',
    aliceVault.ecdsaPrivateKey,
    'alice',
    'bob',
    alice.publicEcdhJwk,
    alice.publicEcdsaJwk,
    3
  );
  initialPayloads.push(msg3);

  saveStoredMessages(initialPayloads);
}

// --- Session Key Helper ---

function getSessionCacheKey(userA: string, userB: string): string {
  return [userA, userB].sort().join('<->');
}

export async function getOrCreateSessionKey(
  currentUserId: string,
  peerUserId: string
): Promise<CryptoKey> {
  const cacheKey = getSessionCacheKey(currentUserId, peerUserId);
  if (sessionKeyCache.has(cacheKey)) {
    return sessionKeyCache.get(cacheKey)!;
  }

  const myVault = unlockedVaultCache.get(currentUserId);
  if (!myVault) {
    throw new Error(`Private key vault for ${currentUserId} is locked. Please log in.`);
  }

  const peerUser = getUserById(peerUserId);
  if (!peerUser) {
    throw new Error(`Recipient ${peerUserId} not found in public directory.`);
  }

  const t0 = performance.now();
  const { sessionKey, sharedSecretHex, keyFingerprint } = await deriveSessionKey(
    myVault.ecdhPrivateKey,
    peerUser.publicEcdhJwk
  );

  auditLogger.record(
    'ECDH_AGREE',
    currentUserId,
    `Computed ECDH P-256 shared secret with ${peerUserId} & derived AES-256-GCM session key via HKDF (Key Fingerprint: ${keyFingerprint})`,
    performance.now() - t0,
    'SUCCESS',
    { peerUserId, sharedSecretPrefix: sharedSecretHex.substring(0, 16) + '...' }
  );

  sessionKeyCache.set(cacheKey, sessionKey);
  return sessionKey;
}

// --- Authentication & Vault Unlocking ---

export async function authenticateAndUnlock(
  userId: string,
  passwordAttempt: string
): Promise<{ success: boolean; error?: string }> {
  const user = getUserById(userId);
  if (!user) {
    return { success: false, error: 'User does not exist.' };
  }

  const t0 = performance.now();
  const saltBuffer = base64ToBuffer(user.salt);
  const derivedAuthHash = await hashPasswordForAuth(passwordAttempt, saltBuffer);

  if (derivedAuthHash !== user.passwordHash) {
    auditLogger.record(
      'PBKDF2',
      userId,
      `Authentication failed: Incorrect password`,
      performance.now() - t0,
      'ERROR'
    );
    return { success: false, error: 'Incorrect password.' };
  }

  // Derive Vault Encryption Key
  const vaultKey = await deriveKeyFromPassword(passwordAttempt, saltBuffer);

  try {
    const unlockedVault = await decryptKeyVault(
      user.encryptedKeyVault,
      user.vaultIv,
      vaultKey,
      user.publicEcdhJwk,
      user.publicEcdsaJwk
    );

    unlockedVaultCache.set(userId, unlockedVault);
    localStorage.setItem(ACTIVE_USER_KEY, userId);

    auditLogger.record(
      'VAULT_UNLOCK',
      userId,
      `Successfully unlocked AES-256-GCM encrypted private Key Vault via PBKDF2`,
      performance.now() - t0,
      'SUCCESS'
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to decrypt private key vault.' };
  }
}

export async function registerNewUser(
  username: string,
  displayName: string,
  role: string,
  password: string,
  avatarColor: string = 'violet'
): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
  const cleanId = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleanId) {
    return { success: false, error: 'Username must contain valid letters or numbers.' };
  }
  if (getUserById(cleanId)) {
    return { success: false, error: 'Username is already taken.' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const t0 = performance.now();
  const saltBytes = generateRandomBytes(16);
  const saltBuffer = saltBytes.buffer;
  const saltBase64 = bufferToBase64(saltBytes);

  const vaultKey = await deriveKeyFromPassword(password, saltBuffer as ArrayBuffer);
  const passwordHash = await hashPasswordForAuth(password, saltBuffer as ArrayBuffer);
  const keyBundle = await generateIdentityKeyBundle();

  const { encryptedVault, iv } = await encryptKeyVault(
    keyBundle.privateEcdhJwk,
    keyBundle.privateEcdsaJwk,
    vaultKey
  );

  const newUser: UserProfile = {
    id: cleanId,
    displayName: displayName || cleanId,
    role: role || 'Member',
    avatarColor,
    salt: saltBase64,
    passwordHash,
    encryptedKeyVault: encryptedVault,
    vaultIv: iv,
    publicEcdhJwk: keyBundle.publicEcdhJwk,
    publicEcdsaJwk: keyBundle.publicEcdsaJwk,
    createdAt: new Date().toISOString(),
  };

  const users = getStoredUsers();
  users.push(newUser);
  saveStoredUsers(users);

  // Unlock in cache immediately
  const unlocked = await decryptKeyVault(
    encryptedVault,
    iv,
    vaultKey,
    keyBundle.publicEcdhJwk,
    keyBundle.publicEcdsaJwk
  );
  unlockedVaultCache.set(cleanId, unlocked);
  localStorage.setItem(ACTIVE_USER_KEY, cleanId);

  auditLogger.record(
    'KEYGEN',
    cleanId,
    `Registered new account and created ECDH/ECDSA cryptographic identity with zero-knowledge vault`,
    performance.now() - t0,
    'SUCCESS'
  );

  return { success: true, user: newUser };
}

export function getActiveUserId(): string {
  const saved = localStorage.getItem(ACTIVE_USER_KEY);
  if (saved && getUserById(saved)) {
    return saved;
  }
  const users = getStoredUsers();
  return users.length > 0 ? users[0].id : 'alice';
}

export function setActiveUserId(userId: string): void {
  localStorage.setItem(ACTIVE_USER_KEY, userId);
  notifyMessageSubscribers();
}

export function isVaultUnlocked(userId: string): boolean {
  return unlockedVaultCache.has(userId);
}

// --- Messages Storage & Operations ---

export function getStoredMessages(): EncryptedPayload[] {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredMessages(messages: EncryptedPayload[]): void {
  try {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    notifyMessageSubscribers();
  } catch {
    // ignore
  }
}

export async function sendMessage(
  senderId: string,
  recipientId: string,
  plaintext: string,
  simulateMitmTamper: boolean = false
): Promise<EncryptedPayload> {
  const myVault = unlockedVaultCache.get(senderId);
  if (!myVault) {
    throw new Error(`Key Vault is locked for ${senderId}. Please authenticate.`);
  }

  const senderUser = getUserById(senderId);
  if (!senderUser) {
    throw new Error(`Sender profile ${senderId} not found.`);
  }

  const sessionKey = await getOrCreateSessionKey(senderId, recipientId);
  const existingMsgs = getStoredMessages().filter(
    m => (m.senderId === senderId && m.recipientId === recipientId) ||
         (m.senderId === recipientId && m.recipientId === senderId)
  );
  const nextSeq = existingMsgs.length + 1;

  const t0 = performance.now();
  const payload = await encryptAndSignMessage(
    sessionKey,
    plaintext,
    myVault.ecdsaPrivateKey,
    senderId,
    recipientId,
    senderUser.publicEcdhJwk,
    senderUser.publicEcdsaJwk,
    nextSeq
  );

  if (simulateMitmTamper) {
    // Man-in-the-middle corrupts 1 character in the ciphertext
    const rawCipher = payload.ciphertext;
    const alteredChar = rawCipher[0] === 'A' ? 'B' : 'A';
    payload.ciphertext = alteredChar + rawCipher.slice(1);
    payload.tamperedByMitm = true;

    auditLogger.record(
      'TAMPER_DETECTED',
      'MITM_Attacker',
      `Interception simulation: Injected bit flip into ciphertext payload in transit!`,
      0.1,
      'INTEGRITY_FAIL',
      { originalLength: rawCipher.length, targetId: payload.id }
    );
  } else {
    auditLogger.record(
      'AES_GCM_ENCRYPT',
      senderId,
      `Encrypted message with AES-256-GCM & signed with ECDSA P-256 for ${recipientId}`,
      performance.now() - t0,
      'SUCCESS',
      { seq: nextSeq, ivPrefix: payload.iv.substring(0, 8) + '...' }
    );
  }

  const allMsgs = getStoredMessages();
  allMsgs.push(payload);
  saveStoredMessages(allMsgs);

  return payload;
}

export async function decryptConversationMessages(
  currentUserId: string,
  peerUserId: string
): Promise<DecryptedMessage[]> {
  const allMsgs = getStoredMessages();
  const relevant = allMsgs.filter(
    m => (m.senderId === currentUserId && m.recipientId === peerUserId) ||
         (m.senderId === peerUserId && m.recipientId === currentUserId)
  );

  const sessionKey = await getOrCreateSessionKey(currentUserId, peerUserId);
  const decryptedList: DecryptedMessage[] = [];

  for (const raw of relevant) {
    const t0 = performance.now();
    const result = await verifyAndDecryptMessage(sessionKey, raw);

    if (result.integrityStatus === 'tampered') {
      auditLogger.record(
        'TAMPER_DETECTED',
        currentUserId,
        `Cryptographic integrity breach detected for message ${raw.id.substring(0, 8)}! ${result.errorMessage || ''}`,
        result.durationMs,
        'INTEGRITY_FAIL'
      );
    }

    decryptedList.push({
      id: raw.id,
      senderId: raw.senderId,
      recipientId: raw.recipientId,
      timestamp: raw.timestamp,
      plaintext: result.plaintext,
      rawPayload: raw,
      integrityStatus: result.integrityStatus,
      integrityDetails: {
        signatureValid: result.signatureValid,
        aeadTagValid: result.aeadTagValid,
        errorMessage: result.errorMessage,
        verificationDurationMs: performance.now() - t0,
      },
    });
  }

  return decryptedList;
}

// Tamper simulation on an existing message
export function tamperExistingMessage(
  messageId: string,
  tamperType: 'flip_ciphertext' | 'flip_iv' | 'corrupt_signature'
): boolean {
  const msgs = getStoredMessages();
  const msg = msgs.find(m => m.id === messageId);
  if (!msg) return false;

  if (tamperType === 'flip_ciphertext') {
    const chars = msg.ciphertext.split('');
    chars[0] = chars[0] === 'A' ? 'B' : 'A';
    msg.ciphertext = chars.join('');
  } else if (tamperType === 'flip_iv') {
    const chars = msg.iv.split('');
    chars[0] = chars[0] === 'X' ? 'Y' : 'X';
    msg.iv = chars.join('');
  } else if (tamperType === 'corrupt_signature') {
    const chars = msg.signature.split('');
    chars[0] = chars[0] === 'Z' ? 'W' : 'Z';
    msg.signature = chars.join('');
  }

  msg.tamperedByMitm = true;
  saveStoredMessages(msgs);

  auditLogger.record(
    'TAMPER_DETECTED',
    'Attacker',
    `Manual injection: Tampered with ${tamperType} on message ${messageId.substring(0, 8)}`,
    0.2,
    'INTEGRITY_FAIL'
  );

  return true;
}

// Clear or Reset Chat
export function clearConversation(userA: string, userB: string): void {
  const msgs = getStoredMessages();
  const filtered = msgs.filter(
    m => !((m.senderId === userA && m.recipientId === userB) ||
          (m.senderId === userB && m.recipientId === userA))
  );
  saveStoredMessages(filtered);
}

// --- Safety Numbers & Out-of-Band Key Verification ---

export function getVerifiedContacts(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(VERIFIED_KEYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setContactVerification(userA: string, userB: string, verified: boolean): void {
  const pairKey = [userA, userB].sort().join(':');
  const stored = getVerifiedContacts();
  stored[pairKey] = verified;
  try {
    localStorage.setItem(VERIFIED_KEYS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
  notifyMessageSubscribers();
}

export function isContactVerified(userA: string, userB: string): boolean {
  const pairKey = [userA, userB].sort().join(':');
  const stored = getVerifiedContacts();
  return Boolean(stored[pairKey]);
}

export async function getSafetyNumberInfo(userA_Id: string, userB_Id: string): Promise<SafetyNumberInfo | null> {
  const userA = getUserById(userA_Id);
  const userB = getUserById(userB_Id);
  if (!userA || !userB) return null;

  const { safetyNumberFormatted } = await computeSafetyNumber(
    userA.publicEcdhJwk,
    userB.publicEcdhJwk,
    userA_Id,
    userB_Id
  );

  const fingerprintA = await computeKeyFingerprint(userA.publicEcdhJwk);
  const fingerprintB = await computeKeyFingerprint(userB.publicEcdhJwk);

  return {
    combinedSafetyNumber: safetyNumberFormatted,
    fingerprintA,
    fingerprintB,
    isVerified: isContactVerified(userA_Id, userB_Id),
  };
}
