import React, { useState } from 'react';
import { KeyRound, Shield, Copy, Check, ArrowRight, Lock } from 'lucide-react';
import { UserProfile } from '../types/crypto';
import { deriveSessionKey } from '../crypto/webcrypto';
import { isContactVerified } from '../services/storage';

interface KeyRegistryViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onOpenSafetyModal: (contactId: string) => void;
}

export const KeyRegistryView: React.FC<KeyRegistryViewProps> = ({
  currentUser,
  allUsers,
  onOpenSafetyModal,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<UserProfile | null>(
    allUsers.find(u => u.id !== currentUser.id) || null
  );
  const [derivationResult, setDerivationResult] = useState<{
    sharedSecretHex: string;
    keyFingerprint: string;
  } | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulateKeyAgreement = async (peer: UserProfile) => {
    try {
      setIsDeriving(true);
      // Retrieve unlocked vault for current user
      const { authenticateAndUnlock } = await import('../services/storage');
      // Ensure current user is unlocked
      await authenticateAndUnlock(currentUser.id, 'password123');

      // Now derive key
      const { getOrCreateSessionKey } = await import('../services/storage');
      await getOrCreateSessionKey(currentUser.id, peer.id);

      // Also compute directly to display raw shared secret
      const peerPublicJwk = peer.publicEcdhJwk;
      const { generateIdentityKeyBundle, deriveSessionKey: deriveRaw } = await import('../crypto/webcrypto');
      const bundle = await generateIdentityKeyBundle();
      const res = await deriveRaw(bundle.ecdhKeyPair.privateKey, peerPublicJwk);

      setDerivationResult({
        sharedSecretHex: res.sharedSecretHex,
        keyFingerprint: res.keyFingerprint,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeriving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-8 space-y-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Public Key Registry & Diffie-Hellman Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Asymmetric NIST P-256 public keys published for ECDH key agreement and ECDSA signature verification
          </p>
        </div>

        {/* Directory Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {allUsers.map((user) => {
            const isSelf = user.id === currentUser.id;
            const verified = !isSelf && isContactVerified(currentUser.id, user.id);

            return (
              <div
                key={user.id}
                className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition-all ${
                  isSelf
                    ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
                        {user.displayName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{user.displayName}</span>
                          {isSelf && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{user.role}</div>
                      </div>
                    </div>
                  </div>

                  {/* Public Key Specs */}
                  <div className="space-y-2 text-[11px] font-mono bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <div className="text-slate-400 flex justify-between">
                      <span>ECDH Key (P-256):</span>
                      <button
                        onClick={() =>
                          handleCopy(JSON.stringify(user.publicEcdhJwk, null, 2), user.id + '_ecdh')
                        }
                        className="text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedKey === user.id + '_ecdh' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedKey === user.id + '_ecdh' ? 'Copied' : 'JWK'}</span>
                      </button>
                    </div>

                    <div className="text-slate-300 break-all text-[10px]">
                      <span className="text-slate-500">x: </span>
                      {user.publicEcdhJwk.x?.substring(0, 16)}...
                    </div>
                    <div className="text-slate-300 break-all text-[10px]">
                      <span className="text-slate-500">y: </span>
                      {user.publicEcdhJwk.y?.substring(0, 16)}...
                    </div>

                    <div className="pt-1.5 border-t border-slate-800/80 text-slate-400 flex justify-between">
                      <span>ECDSA Verify:</span>
                      <span className="text-slate-300">P-256 / SHA-256</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                  {!isSelf ? (
                    <>
                      <button
                        onClick={() => onOpenSafetyModal(user.id)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                          verified
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-amber-400 bg-amber-500/10'
                        }`}
                      >
                        {verified ? 'Safety Verified' : 'Verify Fingerprint'}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedPeer(user);
                          handleSimulateKeyAgreement(user);
                        }}
                        className="text-xs text-slate-300 hover:text-white font-medium flex items-center gap-1"
                      >
                        <span>Test ECDH</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-emerald-400 font-mono">
                      Vault Encrypted via PBKDF2
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Diffie-Hellman Key Exchange Interactive Simulator */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>ECDH P-256 Key Exchange Protocol Simulator</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Demonstrates how two parties establish a shared symmetric encryption key over an insecure channel without transmitting the key itself.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* User A */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Alice&apos;s Client (You)</span>
              </div>
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <div>Public Key: <span className="text-slate-300">Published to Directory</span></div>
                <div>Private Key: <span className="text-emerald-400 font-bold">Encrypted in Local Vault</span></div>
              </div>
            </div>

            {/* Exchange Center */}
            <div className="text-center space-y-2 py-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full text-xs font-mono text-emerald-300 border border-slate-700">
                <Lock className="w-3 h-3" />
                <span>Diffie-Hellman Curve P-256</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Shared Secret = $P_A \times Q_B = P_B \times Q_A$
              </div>
            </div>

            {/* User B */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>Peer: {selectedPeer?.displayName || 'Bob Chen'}</span>
              </div>
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <div>Public Key: <span className="text-slate-300">Published to Directory</span></div>
                <div>Private Key: <span className="text-indigo-400 font-bold">Encrypted in Peer Vault</span></div>
              </div>
            </div>
          </div>

          {/* Derivation Result Card */}
          {derivationResult && (
            <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  <span>Shared Secret & HKDF Symmetric Session Key Derived</span>
                </span>
                <span className="font-mono text-slate-400">
                  Algorithm: HKDF-SHA256 &rarr; AES-256-GCM
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div>
                  <div className="text-slate-400 text-[11px]">256-bit Raw Diffie-Hellman Shared Secret (Hex):</div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-300 break-all select-all">
                    {derivationResult.sharedSecretHex}
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">Derived Session Key Fingerprint:</div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 text-emerald-300">
                    {derivationResult.keyFingerprint}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                An eavesdropper seeing the public keys on the network cannot compute this shared secret without solving the discrete logarithm problem over the elliptic curve.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
