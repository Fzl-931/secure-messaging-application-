import { AuditLogEntry } from '../types/crypto';

type AuditLogListener = (logs: AuditLogEntry[]) => void;

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private listeners: Set<AuditLogListener> = new Set();
  private maxLogs = 100;

  constructor() {
    // Load from sessionStorage if available
    try {
      const stored = sessionStorage.getItem('aegiscrypt_audit_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch {
      // ignore
    }
  }

  public record(
    operation: AuditLogEntry['operation'],
    actor: string,
    description: string,
    durationMs: number,
    status: AuditLogEntry['status'] = 'SUCCESS',
    technicalDetails?: Record<string, unknown>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      operation,
      actor,
      description,
      durationMs: Number(durationMs.toFixed(2)),
      status,
      technicalDetails,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    try {
      sessionStorage.setItem('aegiscrypt_audit_logs', JSON.stringify(this.logs));
    } catch {
      // ignore
    }

    this.notify();
    return entry;
  }

  public getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    try {
      sessionStorage.removeItem('aegiscrypt_audit_logs');
    } catch {
      // ignore
    }
    this.notify();
  }

  public subscribe(listener: AuditLogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = [...this.logs];
    this.listeners.forEach(fn => fn(snapshot));
  }
}

export const auditLogger = new AuditLogger();
