import { and, eq, isNotNull, lte } from 'drizzle-orm';
import type { AppDatabase } from '../database/client.js';
import { auditLogs, organizations, publications, setupSessions, terms } from '../database/schema.js';
import type { RefreshQueue } from './refresh-queue.js';

export class TermScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private readonly db: AppDatabase, private readonly queue: RefreshQueue, private readonly onError: (error: unknown) => void = () => undefined) {}
  async processOverdue(now = new Date()): Promise<number> {
    this.db.delete(setupSessions).where(lte(setupSessions.expiresAt, now)).run();
    const overdue = this.db.select().from(terms).where(and(eq(terms.status, 'active'), isNotNull(terms.scheduledEndAt), lte(terms.scheduledEndAt, now))).all();
    let count = 0;
    for (const term of overdue) {
      const changed = this.db.transaction((tx) => {
        const result = tx.update(terms).set({ status: 'expired', actualEndAt: now }).where(and(eq(terms.id, term.id), eq(terms.status, 'active'))).run();
        if (result.changes !== 1) return false;
        const organization = tx.select().from(organizations).where(eq(organizations.id, term.organizationId)).get();
        if (organization) tx.insert(auditLogs).values({ guildId: organization.guildId, organizationId: term.organizationId, actorUserId: 'system', action: 'term.expired', metadata: { termId: term.id } }).run();
        return true;
      });
      if (changed) { count += 1; this.db.select({ id: publications.id }).from(publications).where(and(eq(publications.organizationId, term.organizationId), eq(publications.autoRefresh, true))).all().forEach((row) => this.queue.enqueue(row.id)); }
    }
    return count;
  }
  async processScheduled(now = new Date()): Promise<number> {
    const due = this.db.select().from(terms).where(and(eq(terms.status, 'scheduled'), lte(terms.startAt, now))).all(); let count = 0;
    for (const term of due) {
      const changed = this.db.transaction((tx) => {
        if (tx.select().from(terms).where(and(eq(terms.organizationId, term.organizationId), eq(terms.status, 'active'))).get()) return false;
        const result = tx.update(terms).set({ status: 'active' }).where(and(eq(terms.id, term.id), eq(terms.status, 'scheduled'))).run(); if (result.changes !== 1) return false;
        const organization = tx.select().from(organizations).where(eq(organizations.id, term.organizationId)).get(); if (organization) tx.insert(auditLogs).values({ guildId: organization.guildId, organizationId: term.organizationId, actorUserId: 'system', action: 'term.activated', metadata: { termId: term.id } }).run(); return true;
      });
      if (changed) { count += 1; this.db.select({ id: publications.id }).from(publications).where(and(eq(publications.organizationId, term.organizationId), eq(publications.autoRefresh, true))).all().forEach((row) => this.queue.enqueue(row.id)); }
    }
    return count;
  }
  private async tick(): Promise<void> { await this.processScheduled(); await this.processOverdue(); }
  private runTick(): void { void this.tick().catch((error: unknown) => this.onError(error)); }
  start(intervalMs = 60_000): void { this.runTick(); this.timer = setInterval(() => this.runTick(), intervalMs); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
