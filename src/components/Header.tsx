import React from 'react';
import { Shield, KeyRound, Radio, Terminal, UserCheck, ArrowRightLeft } from 'lucide-react';
import { UserProfile } from '../types/crypto';

interface HeaderProps {
  currentView: 'chat' | 'tamper' | 'registry' | 'audit';
  onViewChange: (view: 'chat' | 'tamper' | 'registry' | 'audit') => void;
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  onSwitchUser: (userId: string) => void;
  onOpenAuthModal: () => void;
  auditCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  currentUser,
  allUsers,
  onSwitchUser,
  onOpenAuthModal,
  auditCount,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 border-b border-slate-800 shrink-0">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Shield className="w-4 h-4 stroke-[2.2]" />
        </div>
        <button
          onClick={() => onViewChange('chat')}
          className="text-lg font-bold tracking-tight text-white hover:text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
        >
          AegisCrypt
        </button>
        <span className="hidden sm:inline-block text-xs text-slate-400 font-mono">
          E2EE · P-256 · AES-GCM
        </span>
      </div>

      {/* Zone 2: Navigation Links (Single-Line, clean text) */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
        <button
          onClick={() => onViewChange('chat')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 py-1 ${
            currentView === 'chat'
              ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Messages</span>
        </button>

        <button
          onClick={() => onViewChange('tamper')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 py-1 ${
            currentView === 'tamper'
              ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Tamper Lab & AEAD</span>
        </button>

        <button
          onClick={() => onViewChange('registry')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 py-1 ${
            currentView === 'registry'
              ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Key Registry</span>
        </button>

        <button
          onClick={() => onViewChange('audit')}
          className={`transition-colors whitespace-nowrap flex items-center gap-1.5 py-1 ${
            currentView === 'audit'
              ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Crypto Audit</span>
          <span className="text-xs font-mono text-slate-400 tabular-nums">({auditCount})</span>
        </button>
      </nav>

      {/* Zone 3: Active Profile & Switcher */}
      <div className="flex items-center gap-3 shrink-0">
        {currentUser && (
          <div className="hidden lg:flex items-center gap-2 pr-2 border-r border-slate-800 text-xs">
            <span className="text-slate-400">Persona:</span>
            <div className="flex items-center gap-1">
              {allUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => onSwitchUser(u.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    u.id === currentUser.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={`Switch active persona to ${u.displayName}`}
                >
                  {u.displayName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentUser ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 rounded-lg text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
              title="Manage Account & Vault"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{currentUser.displayName}</span>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4" />
            <span>Unlock Vault</span>
          </button>
        )}
      </div>
    </header>
  );
};
