import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Lock, Search, Plus, Key } from 'lucide-react';
import { UserProfile } from '../types/crypto';
import { isContactVerified } from '../services/storage';

interface SidebarProps {
  currentUser: UserProfile;
  contacts: UserProfile[];
  selectedContactId: string;
  onSelectContact: (contactId: string) => void;
  onOpenSafetyModal: (contactId: string) => void;
  onOpenRegisterModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  contacts,
  selectedContactId,
  onSelectContact,
  onOpenSafetyModal,
  onOpenRegisterModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = contacts.filter(c =>
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 bg-slate-900/60 border-r border-slate-800 flex flex-col shrink-0 h-full">
      {/* Current Active User Vault Info Card */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-sm text-emerald-400">
              {currentUser.displayName.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-tight">
                {currentUser.displayName}
              </div>
              <div className="text-xs text-slate-400">{currentUser.role}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            <Lock className="w-3 h-3" />
            Vault Unlocked
          </span>
        </div>

        <div className="text-[11px] text-slate-400 font-mono bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800/80 flex items-center justify-between">
          <span>P-256 FP:</span>
          <span className="text-slate-300">
            {currentUser.publicEcdhJwk.x?.substring(0, 10)}...
          </span>
        </div>
      </div>

      {/* Contacts List Header & Search */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Encrypted Channels
          </span>
          <button
            onClick={onOpenRegisterModal}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 font-medium"
            title="Create or invite new identity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Peer</span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search peer or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Peer Contacts List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredContacts.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No contacts match &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          filteredContacts.map(contact => {
            const isSelected = contact.id === selectedContactId;
            const verified = isContactVerified(currentUser.id, contact.id);

            return (
              <div
                key={contact.id}
                onClick={() => onSelectContact(contact.id)}
                className={`w-full group rounded-lg p-2.5 transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-800/90 border-slate-700/80 text-white shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-slate-800/40 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-medium text-xs text-slate-300 shrink-0">
                      {contact.displayName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate text-slate-200">
                        {contact.displayName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {contact.role}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSafetyModal(contact.id);
                      }}
                      className="p-1 rounded hover:bg-slate-700/60 transition-colors"
                      title={verified ? 'Safety number verified' : 'Click to verify safety number'}
                    >
                      {verified ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-amber-400/80" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Key className="w-3 h-3 text-emerald-500" />
                    ECDH P-256
                  </span>
                  <span>{verified ? 'Identity Verified' : 'Unverified FP'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Real-time sync note */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Cross-tab sync</span>
        <span className="font-mono text-emerald-400">BroadcastChannel Active</span>
      </div>
    </aside>
  );
};
