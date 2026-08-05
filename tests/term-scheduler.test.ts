import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/infrastructure/database/client.js';
import { guildConfigs, organizations, publications, templates, terms } from '../src/infrastructure/database/schema.js';
import { RefreshQueue } from '../src/infrastructure/scheduler/refresh-queue.js';
import { TermScheduler } from '../src/infrastructure/scheduler/term-scheduler.js';

describe('재시작 안전 임기 스케줄러', () => {
  it('기한이 지난 활성 임기를 한 번만 만료시키고 게시 갱신을 예약한다', async () => {
    const { db, sqlite } = createDatabase(':memory:'); migrate(db, { migrationsFolder: resolve('./drizzle') });
    db.insert(guildConfigs).values({ guildId: 'guild' }).run(); const org = db.insert(organizations).values({ guildId: 'guild', key: 'example', name: '예시' }).returning().get();
    const template = db.insert(templates).values({ organizationId: org.id, name: '기본', content: '내용' }).returning().get(); db.insert(publications).values({ organizationId: org.id, templateId: template.id, name: '게시', channelId: 'channel' }).run();
    const term = db.insert(terms).values({ organizationId: org.id, displayName: '지난 임기', startAt: new Date('2026-01-01T00:00:00Z'), scheduledEndAt: new Date('2026-02-01T00:00:00Z'), status: 'active' }).returning().get();
    const queue = new RefreshQueue(async () => undefined, 10_000); const scheduler = new TermScheduler(db, queue);
    await expect(scheduler.processOverdue(new Date('2026-03-01T00:00:00Z'))).resolves.toBe(1); await expect(scheduler.processOverdue(new Date('2026-03-01T00:00:00Z'))).resolves.toBe(0);
    expect(db.query.terms.findFirst({ where: (table, { eq }) => eq(table.id, term.id) }).sync()?.status).toBe('expired'); expect(queue.size).toBe(1);
    queue.cancelAll(); sqlite.close();
  });
});
