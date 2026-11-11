import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CryptoInspectorModal } from './components/CryptoInspectorModal';
import { SafetyNumberModal } from './components/SafetyNumberModal';
import { TamperLab } from './components/TamperLab';
import { KeyRegistryView } from './components/KeyRegistryView';
import { AuditLogDrawer } from './components/AuditLogDrawer';
import { AuthModal } from './components/AuthModal';
import {
  UserProfile,
  DecryptedMessage,
  AuditLogEntry,
} from './types/crypto';
import {
  initializeDatabase,
  getStoredUsers,
  getActiveUserId,
  setActiveUserId,
  decryptConversationMessages,
  subscribeToMessages,
  getUserById,
  authenticateAndUnlock,
} from './services/storage';
import { auditLogger } from './crypto/auditLog';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'tamper' | 'registry' | 'audit'>('chat');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>('bob');
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Modals
  const [inspectingMessage, setInspectingMessage] = useState<DecryptedMessage | null>(null);
  const [safetyModalContactId, setSafetyModalContactId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Initialize database and keys on mount
  useEffect(() => {
    let isMounted = true;
    initializeDatabase().then(() => {
      if (!isMounted) return;
      const storedUsers = getStoredUsers();
      setAllUsers(storedUsers);

      const activeId = getActiveUserId();
      const user = getUserById(activeId) || storedUsers[0];
      setCurrentUser(user);

      // Select first contact that is not the current user
      const defaultPeer = storedUsers.find(u => u.id !== user.id)?.id || 'bob';
      setSelectedContactId(defaultPeer);

      setIsReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe to audit logs
  useEffect(() => {
    return auditLogger.subscribe((newLogs) => {
      setAuditLogs(newLogs);
    });
  }, []);

  // Decrypt conversation messages whenever current user or selected contact changes or new messages arrive
  const loadDecryptedMessages = useCallback(async () => {
    if (!currentUser || !selectedContactId) return;
    try {
      const list = await decryptConversationMessages(currentUser.id, selectedContactId);
      setMessages(list);
    } catch (err) {
      console.error('Error decrypting messages:', err);
    }
  }, [currentUser, selectedContactId]);

  useEffect(() => {
    if (!isReady || !currentUser) return;
    loadDecryptedMessages();
  }, [isReady, currentUser, selectedContactId, loadDecryptedMessages]);

  // Subscribe to storage / broadcast channel events
  useEffect(() => {
    return subscribeToMessages(() => {
      loadDecryptedMessages();
    });
  }, [loadDecryptedMessages]);

  // Switch persona handler
  const handleSwitchUser = async (userId: string) => {
    if (userId === currentUser?.id) return;
    try {
      await authenticateAndUnlock(userId, 'password123');
      setActiveUserId(userId);
      const user = getUserById(userId);
      if (user) {
        setCurrentUser(user);
        // If current contact was the same user, switch contact to someone else
        if (selectedContactId === userId) {
          const newContact = allUsers.find(u => u.id !== userId)?.id || 'alice';
          setSelectedContactId(newContact);
        }
      }
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  if (!isReady || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">
          Initializing AegisCrypt Web Crypto Engine
        </h2>
        <p className="text-xs text-slate-400 font-mono">
          Generating NIST P-256 Elliptic Curves & PBKDF2 Key Vaults...
        </p>
      </div>
    );
  }

  const contacts = allUsers.filter(u => u.id !== currentUser.id);
  const activePeer = allUsers.find(u => u.id === selectedContactId) || contacts[0];
  const safetyPeer = allUsers.find(u => u.id === safetyModalContactId);

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30">
      {/* Top Bar Contract compliant navigation */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        auditCount={auditLogs.length}
      />

      {/* Main Viewport Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {currentView === 'chat' && (
          <>
            <Sidebar
              currentUser={currentUser}
              contacts={contacts}
              selectedContactId={selectedContactId}
              onSelectContact={setSelectedContactId}
              onOpenSafetyModal={(id) => setSafetyModalContactId(id)}
              onOpenRegisterModal={() => setIsAuthModalOpen(true)}
            />

            {activePeer ? (
              <ChatArea
                currentUser={currentUser}
                peerUser={activePeer}
                messages={messages}
                onInspectMessage={setInspectingMessage}
                onOpenSafetyModal={() => setSafetyModalContactId(activePeer.id)}
                onRefreshMessages={loadDecryptedMessages}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                Select a contact from the sidebar to establish an encrypted session.
              </div>
            )}
          </>
        )}

        {currentView === 'tamper' && activePeer && (
          <TamperLab currentUser={currentUser} peerUser={activePeer} />
        )}

        {currentView === 'registry' && (
          <KeyRegistryView
            currentUser={currentUser}
            allUsers={allUsers}
            onOpenSafetyModal={(id) => setSafetyModalContactId(id)}
          />
        )}

        {currentView === 'audit' && <AuditLogDrawer logs={auditLogs} />}
      </main>

      {/* Modals & Inspection Drawers */}
      {inspectingMessage && activePeer && (
        <CryptoInspectorModal
          message={inspectingMessage}
          currentUserId={currentUser.id}
          peerUserId={activePeer.id}
          onClose={() => setInspectingMessage(null)}
          onTamperSaved={loadDecryptedMessages}
        />
      )}

      {safetyPeer && (
        <SafetyNumberModal
          currentUser={currentUser}
          peerUser={safetyPeer}
          onClose={() => setSafetyModalContactId(null)}
          onVerificationChanged={loadDecryptedMessages}
        />
      )}

      {isAuthModalOpen && (
        <AuthModal
          currentUser={currentUser}
          onClose={() => setIsAuthModalOpen(false)}
          onUserAuthenticated={(u) => {
            setAllUsers(getStoredUsers());
            setCurrentUser(u);
            const newPeer = getStoredUsers().find(x => x.id !== u.id)?.id || 'bob';
            setSelectedContactId(newPeer);
          }}
        />
      )}
    </div>
  );
}
