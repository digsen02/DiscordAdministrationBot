import { describe, expect, it } from 'vitest';
import { resolveRoleBinding, type MemberSnapshot } from '../src/domain/role-binding/resolver.js';

const member = (id: string, name: string, roles: string[]): MemberSnapshot => ({ id, displayName: name, roleIds: new Set(roles) });
const binding = { key: 'chair', displayName: '대표', discordRoleId: '100000000000000001', cardinality: 'one' as const, required: true };

describe('역할 연결 해석', () => {
  it('보유자가 없으면 공석과 필수 경고를 반환한다', () => { const result = resolveRoleBinding(binding, true, []); expect(result.vacant).toBe(true); expect(result.valid).toBe(false); expect(result.warnings[0]).toContain('필수'); });
  it('한 명이면 이름과 안전한 멘션을 만든다', () => { const result = resolveRoleBinding(binding, true, [member('200000000000000001', '가람', [binding.discordRoleId])]); expect(result).toMatchObject({ count: 1, valid: true, joinedNames: '가람', joinedMentions: '<@200000000000000001>' }); });
  it('단일 역할에 여러 명이면 위반 경고를 반환한다', () => { const result = resolveRoleBinding(binding, true, [member('1', '가', [binding.discordRoleId]), member('2', '나', [binding.discordRoleId])]); expect(result.valid).toBe(false); expect(result.warnings.join(' ')).toContain('1명'); });
  it('Discord 역할이 삭제되어도 연결 정보를 보존하고 broken으로 표시한다', () => { const result = resolveRoleBinding(binding, false, [member('1', '가', [binding.discordRoleId])]); expect(result).toMatchObject({ broken: true, count: 0, roleId: binding.discordRoleId }); });
});
