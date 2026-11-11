import React from 'react';
import { Lock, ShieldAlert, ShieldCheck, Binary, Zap } from 'lucide-react';
import { DecryptedMessage } from '../types/crypto';

interface MessageItemProps {
  message: DecryptedMessage;
  isCurrentUserSender: boolean;
  senderName: string;
  onInspect: (message: DecryptedMessage) => void;
  onTamper: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isCurrentUserSender,
  senderName,
  onInspect,
  onTamper,
}) => {
  const isTampered = message.integrityStatus === 'tampered';
  const isError = message.integrityStatus === 'error';
  const timeFormatted = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex flex-col mb-4 ${
        isCurrentUserSender ? 'items-end' : 'items-start'
      }`}
    >
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className="text-xs font-semibold text-slate-400">
          {isCurrentUserSender ? 'You' : senderName}
        </span>
        <span className="text-[11px] text-slate-500 font-mono tabular-nums">
          {timeFormatted}
        </span>
        {isTampered ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400 font-mono bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
            <ShieldAlert className="w-3 h-3" />
            Integrity Failed
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-mono">
            <Lock className="w-3 h-3" />
            E2EE
          </span>
        )}
      </div>

      <div
        className={`max-w-xl rounded-xl p-3.5 border transition-all ${
          isTampered
            ? 'bg-rose-950/30 border-rose-500/40 text-rose-100 shadow-sm'
            : isCurrentUserSender
            ? 'bg-emerald-950/30 border-emerald-500/30 text-slate-100'
            : 'bg-slate-900 border-slate-800 text-slate-200'
        }`}
      >
        {isTampered ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-rose-300">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  Tamper Alert: Message Integrity Violated
                </div>
                <div className="text-xs mt-1 text-rose-200">
                  {message.integrityDetails.errorMessage ||
                    'AEAD Authentication Tag or ECDSA signature mismatch. A rogue network node modified this payload in transit.'}
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono bg-rose-950/80 p-2 rounded border border-rose-800/40 text-rose-300 break-all">
              <span className="text-rose-400 font-semibold">Raw Corrupted Ciphertext:</span>{' '}
              {message.rawPayload.ciphertext.substring(0, 48)}...
            </div>
          </div>
        ) : isError ? (
          <div className="text-xs text-amber-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Cryptographic error occurred while decrypting.</span>
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.plaintext}
          </div>
        )}

        {/* Cryptographic Controls & Wire Inspector Triggers */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onInspect(message)}
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              title="Inspect raw ciphertext, IV, AEAD Tag, and signature"
            >
              <Binary className="w-3.5 h-3.5" />
              <span>Inspect Wire</span>
            </button>

            {!isTampered && (
              <button
                onClick={() => onTamper(message.id)}
                className="flex items-center gap-1 text-amber-400/90 hover:text-amber-300 transition-colors cursor-pointer"
                title="Simulate network bit-flip tampering on this message"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Simulate MITM</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            {message.integrityDetails.verificationDurationMs !== undefined && (
              <span className="tabular-nums">
                {message.integrityDetails.verificationDurationMs.toFixed(1)}ms
              </span>
            )}
            {message.integrityDetails.signatureValid && (
              <span title="ECDSA P-256 signature verified" className="inline-flex">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
