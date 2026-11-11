import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Copy, Check, Terminal, Play } from 'lucide-react';
import { DecryptedMessage } from '../types/crypto';
import { base64ToBuffer, bufferToHex, verifyAndDecryptMessage } from '../crypto/webcrypto';
import { getOrCreateSessionKey } from '../services/storage';

interface CryptoInspectorModalProps {
  message: DecryptedMessage;
  currentUserId: string;
  peerUserId: string;
  onClose: () => void;
  onTamperSaved?: () => void;
}

export const CryptoInspectorModal: React.FC<CryptoInspectorModalProps> = ({
  message,
  currentUserId,
  peerUserId,
  onClose,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Playground state for editing payload live
  const [testCiphertext, setTestCiphertext] = useState(message.rawPayload.ciphertext);
  const [testIv, setTestIv] = useState(message.rawPayload.iv);
  const [testSignature, setTestSignature] = useState(message.rawPayload.signature);
  const [liveVerificationResult, setLiveVerificationResult] = useState<{
    status: 'valid' | 'tampered' | 'error';
    plaintext?: string;
    errorMsg?: string;
    durationMs?: number;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const payload = message.rawPayload;

  // Convert Base64 IV and Auth Tag to Hex for high-fidelity cryptographic display
  let ivHex = '';
  let authTagHex = '';
  try {
    ivHex = bufferToHex(base64ToBuffer(payload.iv));
    authTagHex = bufferToHex(base64ToBuffer(payload.authTag));
  } catch {
    ivHex = 'N/A';
    authTagHex = 'N/A';
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRunLiveVerification = async () => {
    try {
      setIsVerifying(true);
      const sessionKey = await getOrCreateSessionKey(currentUserId, peerUserId);
      const testPayload = {
        ...payload,
        ciphertext: testCiphertext,
        iv: testIv,
        signature: testSignature,
      };

      const result = await verifyAndDecryptMessage(sessionKey, testPayload);
      setLiveVerificationResult({
        status: result.integrityStatus,
        plaintext: result.plaintext,
        errorMsg: result.errorMessage,
        durationMs: result.durationMs,
      });
    } catch (err) {
      setLiveVerificationResult({
        status: 'error',
        errorMsg: err instanceof Error ? err.message : 'Decryption failed',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Cryptographic Wire Inspector & Integrity Audit
              </h3>
              <p className="text-xs text-slate-400">
                Direct view into ciphertext payload traveling across untrusted network
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Integrity Status Card */}
          <div
            className={`p-4 rounded-lg border ${
              message.integrityStatus === 'valid'
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold flex items-center gap-1.5">
                {message.integrityStatus === 'valid' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Integrity Verified: AEAD Tag & ECDSA Signature Matched</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Integrity Violation: Message Tampering Detected!</span>
                  </>
                )}
              </span>
              <span className="font-mono text-slate-400 tabular-nums">
                Verified in {message.integrityDetails.verificationDurationMs?.toFixed(2)} ms
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {message.integrityStatus === 'valid'
                ? 'The AES-256-GCM Galois MAC verification succeeded and the sender ECDSA digital signature matches the sender public key.'
                : message.integrityDetails.errorMessage ||
                  'The ciphertext or authentication tag was modified. Web Crypto rejected decryption.'}
            </p>
          </div>

          {/* Cryptographic Primitives Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                Algorithm Suite
              </div>
              <div className="text-slate-200 font-mono">AES-256-GCM (AEAD)</div>
              <div className="text-slate-500 text-[11px]">
                Key Size: 256 bits · Tag Length: 128 bits
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                Key Exchange & Signatures
              </div>
              <div className="text-slate-200 font-mono">ECDH + ECDSA (NIST P-256)</div>
              <div className="text-slate-500 text-[11px]">
                HKDF-SHA256 Derivation · SHA-256 Digest
              </div>
            </div>
          </div>

          {/* Wire Payload Fields */}
          <div className="space-y-4">
            {/* Decrypted Plaintext */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-300">
                  Client Decrypted Plaintext (Zero-Knowledge)
                </span>
                <span className="text-slate-500 font-mono">
                  Never transmitted across wire
                </span>
              </div>
              <div className="font-mono text-emerald-400 bg-slate-900/80 p-2.5 rounded border border-slate-800">
                {message.plaintext || '[Decryption rejected due to integrity error]'}
              </div>
            </div>

            {/* Ciphertext Base64 */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-300">
                  Transmitted Ciphertext (Base64)
                </span>
                <button
                  onClick={() => handleCopy(payload.ciphertext, 'ciphertext')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                >
                  {copiedField === 'ciphertext' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedField === 'ciphertext' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded border border-slate-800 break-all select-all">
                {payload.ciphertext}
              </div>
            </div>

            {/* IV and Auth Tag */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-300">Initialization Vector (96-bit IV)</span>
                  <span className="text-[11px] text-slate-500 font-mono">Hex</span>
                </div>
                <div className="font-mono text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800 break-all">
                  {ivHex}
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-300">AEAD Auth Tag (128-bit MAC)</span>
                  <span className="text-[11px] text-slate-500 font-mono">Hex</span>
                </div>
                <div className="font-mono text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800 break-all">
                  {authTagHex}
                </div>
              </div>
            </div>

            {/* ECDSA Digital Signature */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-300">
                  Sender ECDSA P-256 Digital Signature (Non-Repudiation)
                </span>
                <span className="text-slate-500 font-mono">
                  Signs IV + Ciphertext + Sequence
                </span>
              </div>
              <div className="font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded border border-slate-800 break-all select-all">
                {payload.signature}
              </div>
            </div>
          </div>

          {/* Interactive Live Bit-Flip Tamper Laboratory */}
          <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-950/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-amber-300 text-sm">
                  Interactive MITM Tamper Simulator
                </h4>
                <p className="text-slate-400 text-xs">
                  Modify any character below to test browser Web Crypto AEAD integrity rejection live.
                </p>
              </div>
              <button
                onClick={handleRunLiveVerification}
                disabled={isVerifying}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isVerifying ? 'Verifying...' : 'Test Decryption'}</span>
              </button>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono">
                Editable Ciphertext Payload:
              </label>
              <textarea
                value={testCiphertext}
                onChange={(e) => setTestCiphertext(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const arr = testCiphertext.split('');
                  arr[0] = arr[0] === 'A' ? 'B' : 'A';
                  setTestCiphertext(arr.join(''));
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
              >
                Flip 1st Bit of Ciphertext
              </button>
              <button
                onClick={() => {
                  const arr = testSignature.split('');
                  arr[0] = arr[0] === 'A' ? 'B' : 'A';
                  setTestSignature(arr.join(''));
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
              >
                Corrupt Digital Signature
              </button>
              <button
                onClick={() => {
                  setTestCiphertext(payload.ciphertext);
                  setTestIv(payload.iv);
                  setTestSignature(payload.signature);
                  setLiveVerificationResult(null);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-xs transition-colors ml-auto"
              >
                Reset
              </button>
            </div>

            {liveVerificationResult && (
              <div
                className={`p-3 rounded border text-xs ${
                  liveVerificationResult.status === 'valid'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="font-bold mb-1">
                  {liveVerificationResult.status === 'valid'
                    ? 'Decryption Succeeded: Integrity Verified!'
                    : 'Cryptographic Exception Caught: AEAD Tag/Signature Mismatch!'}
                </div>
                <div>
                  {liveVerificationResult.plaintext ? (
                    <span>Plaintext: &ldquo;{liveVerificationResult.plaintext}&rdquo;</span>
                  ) : (
                    <span className="font-mono">{liveVerificationResult.errorMsg}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
