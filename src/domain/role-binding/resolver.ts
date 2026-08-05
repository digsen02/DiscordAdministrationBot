export interface MemberSnapshot { id: string; displayName: string; roleIds: ReadonlySet<string> }
export interface BindingInput { key: string; displayName: string; discordRoleId: string; cardinality: 'one' | 'many'; required: boolean }
export interface ResolvedRole {
  displayName: string; roleId: string; count: number; names: string[]; mentions: string[]; joinedNames: string; joinedMentions: string;
  vacant: boolean; valid: boolean; broken: boolean; warnings: string[];
}

export function resolveRoleBinding(binding: BindingInput, roleExists: boolean, members: readonly MemberSnapshot[]): ResolvedRole {
  const holders = roleExists ? members.filter((member) => member.roleIds.has(binding.discordRoleId)) : [];
  const warnings: string[] = [];
  if (!roleExists) warnings.push(`연결된 Discord 역할(${binding.discordRoleId})이 삭제되었거나 찾을 수 없습니다.`);
  if (binding.cardinality === 'one' && holders.length > 1) warnings.push(`${binding.displayName} 역할 보유자가 ${holders.length}명입니다. 1명이어야 합니다.`);
  if (binding.required && holders.length === 0) warnings.push(`필수 역할인 ${binding.displayName}의 보유자가 없습니다.`);
  return {
    displayName: binding.displayName, roleId: binding.discordRoleId, count: holders.length,
    names: holders.map((member) => member.displayName), mentions: holders.map((member) => `<@${member.id}>`),
    joinedNames: holders.map((member) => member.displayName).join(', '), joinedMentions: holders.map((member) => `<@${member.id}>`).join(', '),
    vacant: holders.length === 0, valid: roleExists && !(binding.cardinality === 'one' && holders.length > 1) && !(binding.required && holders.length === 0),
    broken: !roleExists, warnings
  };
}
