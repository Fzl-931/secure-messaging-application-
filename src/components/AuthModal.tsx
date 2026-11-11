import React, { useState } from 'react';
import { X, Lock, KeyRound, UserCheck, Shield, Sparkles } from 'lucide-react';
import { UserProfile } from '../types/crypto';
import {
  authenticateAndUnlock,
  registerNewUser,
  getStoredUsers,
} from '../services/storage';

interface AuthModalProps {
  currentUser: UserProfile | null;
  onClose: () => void;
  onUserAuthenticated: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentUser,
  onClose,
  onUserAuthenticated,
}) => {
  const [tab, setTab] = useState<'switch' | 'register' | 'login'>('switch');
  const [users, setUsers] = useState<UserProfile[]>(getStoredUsers());

  // Login form state
  const [loginUserId, setLoginUserId] = useState(users[0]?.id || 'alice');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regRole, setRegRole] = useState('Security Analyst');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleQuickUnlock = async (userId: string) => {
    try {
      setIsLoggingIn(true);
      setLoginError('');
      const res = await authenticateAndUnlock(userId, 'password123');
      if (res.success) {
        const authedUser = getStoredUsers().find(u => u.id === userId);
        if (authedUser) onUserAuthenticated(authedUser);
        onClose();
      } else {
        setLoginError(res.error || 'Authentication failed');
      }
    } catch {
      setLoginError('Error during cryptographic authentication');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoggingIn(true);
      setLoginError('');
      const res = await authenticateAndUnlock(loginUserId, loginPassword);
      if (res.success) {
        const authedUser = getStoredUsers().find(u => u.id === loginUserId);
        if (authedUser) onUserAuthenticated(authedUser);
        onClose();
      } else {
        setLoginError(res.error || 'Invalid credentials');
      }
    } catch {
      setLoginError('Failed to unlock vault with provided password');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword) {
      setRegError('Please provide both username and password.');
      return;
    }

    try {
      setIsRegistering(true);
      setRegError('');
      const res = await registerNewUser(
        regUsername.trim(),
        regDisplayName.trim() || regUsername.trim(),
        regRole.trim() || 'Analyst',
        regPassword
      );

      if (res.success && res.user) {
        setUsers(getStoredUsers());
        onUserAuthenticated(res.user);
        onClose();
      } else {
        setRegError(res.error || 'Registration failed');
      }
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Cryptographic key generation failed');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Cryptographic Authentication & Vault Manager
              </h3>
              <p className="text-xs text-slate-400">
                PBKDF2-SHA256 Client-Side Zero-Knowledge Private Key Storage
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 text-xs">
          <button
            onClick={() => setTab('switch')}
            className={`flex-1 py-2 text-center rounded font-medium transition-colors ${
              tab === 'switch'
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Quick Switch Persona
          </button>
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-2 text-center rounded font-medium transition-colors ${
              tab === 'login'
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Unlock With Password
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-2 text-center rounded font-medium transition-colors ${
              tab === 'register'
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create New Identity
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 text-xs">
          {tab === 'switch' && (
            <div className="space-y-4">
              <p className="text-slate-300 leading-relaxed">
                Choose an active cryptographic persona to test real two-way E2EE conversations.
                Each persona has their own distinct NIST P-256 keypairs and encrypted vault.
              </p>

              <div className="space-y-2.5">
                {users.map(u => {
                  const isActive = currentUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      className={`p-3.5 rounded-lg border transition-all flex items-center justify-between ${
                        isActive
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
                          {u.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-2">
                            <span>{u.displayName}</span>
                            {isActive && (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                Active Vault
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {u.role} · id: <code className="text-slate-300 font-mono">{u.id}</code>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleQuickUnlock(u.id)}
                        disabled={isLoggingIn || isActive}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isActive
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        }`}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{isActive ? 'Current' : 'Switch & Unlock'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {loginError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded text-rose-300 font-mono">
                  {loginError}
                </div>
              )}
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">Select User</label>
                <select
                  value={loginUserId}
                  onChange={(e) => setLoginUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">Master Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter vault password (default: password123)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400">
                  PBKDF2 derives the AES-256-GCM vault key from this password using 100,000 iterations.
                </p>
              </div>

              {loginError && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded text-rose-300">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isLoggingIn ? 'Decrypting Vault...' : 'Unlock Cryptographic Vault'}</span>
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">Username ID</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. dev_sarah"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">Display Name</label>
                  <input
                    type="text"
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">Organizational Role</label>
                <input
                  type="text"
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  placeholder="e.g. Cryptographer, Ops Engineer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">
                  Vault Password (Min 6 chars)
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create a strong password..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {regError && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded text-rose-300">
                  {regError}
                </div>
              )}

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isRegistering
                    ? 'Generating P-256 Keypairs & Encrypting...'
                    : 'Generate Identity & Encrypt Vault'}
                </span>
              </button>
            </form>
          )}

          {/* Cryptographic Security Guarantee */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start gap-2.5 text-slate-400">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-slate-300">Zero-Knowledge Storage: </strong>
              Private keys are generated using <code className="text-emerald-400">window.crypto.subtle</code> and encrypted client-side using AES-256-GCM before any persistence. If the disk or server is compromised, attackers cannot extract your keys without your password.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
