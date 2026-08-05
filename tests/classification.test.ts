import { describe, expect, it } from 'vitest';
import { calculateClassification } from '../src/domain/classification/calculator.js';
import type { MemberSnapshot } from '../src/domain/role-binding/resolver.js';

const BASE = '100000000000000001', A = '100000000000000002', B = '100000000000000003';
const m = (id: string, roles: string[]): MemberSnapshot => ({ id, displayName: `사용자${id}`, roleIds: new Set(roles) });
const input = { displayName: '소속', baseRoleId: BASE, exclusive: true, allowUnassigned: true, unassignedLabel: '미지정', capacity: 2, options: [{ key: 'a', displayName: 'A', discordRoleId: A }, { key: 'b', displayName: 'B', discordRoleId: B }] };

describe('분류 계산', () => {
  it('기준 역할 밖의 사용자를 제외하고 실제 인구/정원 비율을 계산한다', () => { const result = calculateClassification(input, [m('1', [BASE, A]), m('2', [BASE, B]), m('3', [A])]); expect(result.population).toBe(2); expect(result.groups.map((g) => g.count)).toEqual([1, 1]); expect(result.groups[0]?.populationPercentage).toBe(50); expect(result.groups[0]?.capacityPercentage).toBe(50); });
  it('미지정 인원을 센다', () => { expect(calculateClassification(input, [m('1', [BASE])]).unassignedCount).toBe(1); });
  it('배타적 중복 사용자는 경고하고 그룹에 이중 집계하지 않는다', () => { const result = calculateClassification(input, [m('1', [BASE, A, B])]); expect(result.groups.map((g) => g.count)).toEqual([0, 0]); expect(result.warnings.join(' ')).toContain('중복'); });
  it('정원 초과와 0 분모를 안전하게 처리한다', () => { const overflow = calculateClassification({ ...input, capacity: 1 }, [m('1', [BASE, A]), m('2', [BASE, B])]); expect(overflow.overflow).toBe(1); expect(overflow.groups[0]?.capacityPercentage).toBe(100); const empty = calculateClassification(input, []); expect(empty.groups[0]?.populationPercentage).toBe(0); });
});
