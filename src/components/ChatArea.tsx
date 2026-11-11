import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Zap,
  Info,
  RefreshCw,
} from 'lucide-react';
import { UserProfile, DecryptedMessage } from '../types/crypto';
import { MessageItem } from './MessageItem';
import {
  sendMessage,
  tamperExistingMessage,
  clearConversation,
  isContactVerified,
} from '../services/storage';

interface ChatAreaProps {
  currentUser: UserProfile;
  peerUser: UserProfile;
  messages: DecryptedMessage[];
  onInspectMessage: (message: DecryptedMessage) => void;
  onOpenSafetyModal: () => void;
  onRefreshMessages: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUser,
  peerUser,
  messages,
  onInspectMessage,
  onOpenSafetyModal,
  onRefreshMessages,
}) => {
  const [inputText, setInputText] = useState('');
  const [simulateMitm, setSimulateMitm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isVerified = isContactVerified(currentUser.id, peerUser.id);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    try {
      setIsSending(true);
      await sendMessage(currentUser.id, peerUser.id, inputText.trim(), simulateMitm);
      setInputText('');
      setSimulateMitm(false);
      onRefreshMessages();
    } catch (err) {
      console.error('Failed to send secure message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleTamperMessage = (messageId: string) => {
    tamperExistingMessage(messageId, 'flip_ciphertext');
    onRefreshMessages();
  };

  const handleClear = () => {
    if (window.confirm(`Clear encrypted conversation with ${peerUser.displayName}?`)) {
      clearConversation(currentUser.id, peerUser.id);
      onRefreshMessages();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Conversation Top Header */}
      <div className="px-6 py-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-emerald-400">
            {peerUser.displayName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">
                {peerUser.displayName}
              </span>
              <button
                onClick={onOpenSafetyModal}
                className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded transition-colors bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="View Safety Numbers"
              >
                {isVerified ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Verified Safety Number</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">Unverified Fingerprint</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{peerUser.role}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 flex items-center gap-1 font-mono">
                <Lock className="w-3 h-3" />
                ECDH P-256 / AES-256-GCM
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshMessages}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh decryption pipeline"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Clear this conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Security Architecture Kicker Banner */}
      <div className="bg-slate-900/40 border-b border-slate-800/80 px-6 py-2 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Zero-Knowledge E2EE: Ciphertexts are encrypted client-side using derived AES-256 session keys. Private keys never leave the browser.
          </span>
        </div>
        <button
          onClick={onOpenSafetyModal}
          className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 shrink-0 font-medium ml-4"
        >
          Compare Safety Numbers
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">
              End-to-End Encrypted Channel Ready
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Messages exchanged with {peerUser.displayName} are signed with ECDSA P-256 and encrypted with AES-256-GCM. Try sending a confidential dispatch below.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setInputText('Executing cryptographic security audit for project alpha.')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-300 transition-colors"
              >
                Send Audit Memo
              </button>
              <button
                onClick={() => setInputText('Key exchange completed. Verifying safety number fingerprint.')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-300 transition-colors"
              >
                Send Key Confirmation
              </button>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <MessageItem
              key={msg.id}
              message={msg}
              isCurrentUserSender={msg.senderId === currentUser.id}
              senderName={msg.senderId === currentUser.id ? currentUser.displayName : peerUser.displayName}
              onInspect={onInspectMessage}
              onTamper={handleTamperMessage}
            />
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {/* Message Composer & MITM Tamper Laboratory */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        <form onSubmit={handleSend} className="space-y-2">
          {/* MITM Attack Simulator Switch */}
          <div className="flex items-center justify-between text-xs px-1">
            <button
              type="button"
              onClick={() => setSimulateMitm(!simulateMitm)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all font-mono text-[11px] ${
                simulateMitm
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${simulateMitm ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>
                {simulateMitm ? 'MITM Injection Active (1-bit corrupt)' : 'Simulate MITM Attack'}
              </span>
            </button>

            <span className="text-[11px] text-slate-400 font-mono">
              Algorithm: AES-256-GCM + ECDSA P-256
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Send encrypted message to ${peerUser.displayName}...`}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                simulateMitm
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>{simulateMitm ? 'Send Tampered' : 'Send Securely'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
