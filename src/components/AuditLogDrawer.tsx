import React, { useState } from 'react';
import { Terminal, Trash2, Filter } from 'lucide-react';
import { AuditLogEntry } from '../types/crypto';
import { auditLogger } from '../crypto/auditLog';

interface AuditLogDrawerProps {
  logs: AuditLogEntry[];
}

export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({ logs }) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    if (filterType === 'ALL') return true;
    if (filterType === 'TAMPER') return log.status === 'INTEGRITY_FAIL';
    if (filterType === 'CRYPTO') return ['AES_GCM_ENCRYPT', 'AES_GCM_DECRYPT', 'ECDSA_SIGN', 'ECDSA_VERIFY'].includes(log.operation);
    if (filterType === 'KEY') return ['KEYGEN', 'ECDH_AGREE', 'HKDF_DERIVE', 'PBKDF2', 'VAULT_UNLOCK'].includes(log.operation);
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-8 space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <span>Real-Time Cryptographic Audit Stream</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live telemetry tracking every Web Crypto API call executed in your local browser sandbox
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" />
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterType === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({logs.length})
              </button>
              <button
                onClick={() => setFilterType('TAMPER')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterType === 'TAMPER'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tamper Alerts
              </button>
              <button
                onClick={() => setFilterType('CRYPTO')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterType === 'CRYPTO'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AEAD & Signatures
              </button>
              <button
                onClick={() => setFilterType('KEY')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterType === 'KEY'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Key Derivation
              </button>
            </div>

            <button
              onClick={() => auditLogger.clear()}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-slate-800 rounded-lg transition-colors"
              title="Clear audit logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Execution</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                      No cryptographic events match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((entry) => {
                    const isTamper = entry.status === 'INTEGRITY_FAIL';
                    const isError = entry.status === 'ERROR';

                    return (
                      <tr
                        key={entry.id}
                        className={`transition-colors hover:bg-slate-800/40 ${
                          isTamper ? 'bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-4 font-semibold whitespace-nowrap">
                          <span
                            className={
                              isTamper
                                ? 'text-rose-400'
                                : entry.operation.includes('ENCRYPT') || entry.operation.includes('DECRYPT')
                                ? 'text-emerald-400'
                                : 'text-indigo-400'
                            }
                          >
                            {entry.operation}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 font-sans whitespace-nowrap">
                          {entry.actor}
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 max-w-md truncate font-sans">
                          {entry.description}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-400 tabular-nums whitespace-nowrap">
                          {entry.durationMs.toFixed(2)} ms
                        </td>
                        <td className="py-2.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              isTamper
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : isError
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
