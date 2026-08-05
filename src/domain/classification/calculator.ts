import type { MemberSnapshot } from '../role-binding/resolver.js';

export interface ClassificationInput {
  displayName: string; baseRoleId: string; exclusive: boolean; allowUnassigned: boolean; unassignedLabel: string; capacity: number | null;
  options: readonly { key: string; displayName: string; discordRoleId: string }[];
}
export interface ClassificationResult {
  displayName: string; population: number; capacity: number | null; overflow: number; denominator: number; unassignedCount: number;
  unassignedNames: string[]; warnings: string[]; groups: Array<{ key: string; displayName: string; roleId: string; roleMention: string; count: number; populationPercentage: number; capacityPercentage: number | null; memberNames: string[]; memberMentions: string[] }>;
}

const percent = (part: number, total: number): number => total === 0 ? 0 : part / total * 100;

export function calculateClassification(input: ClassificationInput, members: readonly MemberSnapshot[]): ClassificationResult {
  const population = members.filter((member) => member.roleIds.has(input.baseRoleId));
  const conflicts: MemberSnapshot[] = [];
  const unassigned: MemberSnapshot[] = [];
  const assignments = new Map<string, MemberSnapshot[]>();
  input.options.forEach((option) => assignments.set(option.key, []));
  for (const member of population) {
    const matched = input.options.filter((option) => member.roleIds.has(option.discordRoleId));
    if (matched.length === 0) unassigned.push(member);
    if (input.exclusive && matched.length > 1) {
      conflicts.push(member);
      continue;
    }
    matched.forEach((option) => assignments.get(option.key)?.push(member));
  }
  const warnings: string[] = [];
  if (conflicts.length) warnings.push(`배타적 분류에 중복 지정된 사용자: ${conflicts.map((member) => member.displayName).join(', ')}`);
  if (!input.allowUnassigned && unassigned.length) warnings.push(`분류되지 않은 사용자: ${unassigned.map((member) => member.displayName).join(', ')}`);
  const capacity = input.capacity !== null && Number.isFinite(input.capacity) && input.capacity >= 0 ? input.capacity : null;
  const overflow = capacity === null ? 0 : Math.max(0, population.length - capacity);
  if (overflow > 0) warnings.push(`설정된 정원을 ${overflow}명 초과했습니다.`);
  return {
    displayName: input.displayName, population: population.length, capacity, overflow, denominator: population.length,
    unassignedCount: unassigned.length, unassignedNames: unassigned.map((member) => member.displayName), warnings,
    groups: input.options.map((option) => {
      const assigned = assignments.get(option.key) ?? [];
      return { key: option.key, displayName: option.displayName, roleId: option.discordRoleId, roleMention: `<@&${option.discordRoleId}>`, count: assigned.length,
        populationPercentage: percent(assigned.length, population.length), capacityPercentage: capacity === null ? null : percent(assigned.length, capacity),
        memberNames: assigned.map((member) => member.displayName), memberMentions: assigned.map((member) => `<@${member.id}>`) };
    })
  };
}
