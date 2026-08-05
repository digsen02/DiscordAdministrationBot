import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDatabase } from './client.js';
import { classificationOptions, classifications, customFieldDefinitions, guildConfigs, organizations, publications, roleBindings, templates, terms } from './schema.js';

if (existsSync('.env')) loadEnvFile('.env');
const path = resolve(process.env.DATABASE_URL ?? './data/bot.db'); mkdirSync(dirname(path), { recursive: true });
const { db, sqlite } = createDatabase(path); migrate(db, { migrationsFolder: resolve('./drizzle') });
const guildId = process.env.DISCORD_DEV_GUILD_ID ?? '000000000000000001';
if (db.select().from(organizations).where(eq(organizations.key, 'example_org')).get()) {
  process.stdout.write('개발 예시 데이터가 이미 있습니다.\n'); sqlite.close();
} else {
  db.transaction((tx) => {
    tx.insert(guildConfigs).values({ guildId }).onConflictDoNothing().run();
    const org = tx.insert(organizations).values({ guildId, key: 'example_org', name: '예시 조직', description: '개발 환경 전용 예시 데이터' }).returning().get();
    tx.insert(roleBindings).values([
      { organizationId: org.id, key: 'member', displayName: '구성원', discordRoleId: '000000000000000101', kind: 'membership', cardinality: 'many', required: false, displayOrder: 1 },
      { organizationId: org.id, key: 'chair', displayName: '대표', discordRoleId: '000000000000000102', kind: 'office', cardinality: 'one', required: true, displayOrder: 0 }
    ]).run();
    const classification = tx.insert(classifications).values({ organizationId: org.id, key: 'group', displayName: '소속 그룹', baseRoleKey: 'member', exclusive: true, allowUnassigned: true, unassignedLabel: '미지정', capacityFieldKey: 'capacity' }).returning().get();
    tx.insert(classificationOptions).values([
      { classificationId: classification.id, key: 'alpha', displayName: '알파', discordRoleId: '000000000000000201', displayOrder: 0 },
      { classificationId: classification.id, key: 'beta', displayName: '베타', discordRoleId: '000000000000000202', displayOrder: 1 }
    ]).run();
    tx.insert(customFieldDefinitions).values([
      { organizationId: org.id, key: 'capacity', label: '정원', scope: 'organization', type: 'number', required: false, defaultValue: '10' },
      { organizationId: org.id, key: 'founded_date', label: '설립일', scope: 'organization', type: 'date', required: false },
      { organizationId: org.id, key: 'term_note', label: '임기 설명', scope: 'term', type: 'text', required: false }
    ]).run();
    tx.insert(terms).values({ organizationId: org.id, termNumber: 1, displayName: '제1기', startAt: new Date(), status: 'active' }).run();
    const template = tx.insert(templates).values({ organizationId: org.id, name: '개발 예시', content: '# {{ organization.name }}\n대표 | {{ roles.chair.joinedMentions | default: "공석" }}\n구성원 | {{ roles.member.count }}명\n{% for group in classifications.group.groups %}{{ group.roleMention }}: {{ group.count }}명 ({{ group.populationPercentage | percentage }})\n{% endfor %}' }).returning().get();
    tx.insert(publications).values({ organizationId: org.id, templateId: template.id, name: '개발 예시 게시', channelId: '000000000000000301', messageId: null, autoRefresh: false }).run();
  });
  process.stdout.write('개발 전용 예시 데이터를 추가했습니다. 가짜 Discord ID를 실제 ID로 바꾸세요.\n'); sqlite.close();
}
