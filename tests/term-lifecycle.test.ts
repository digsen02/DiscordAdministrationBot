import { describe, expect, it } from 'vitest';
import { assertCanStartTerm, assertTermTransition } from '../src/domain/term/lifecycle.js';

describe('임기 생명주기', () => {
  it.each([['scheduled','active'],['active','expired'],['active','ended'],['active','dissolved'],['active','suspended'],['suspended','active']] as const)('%s → %s 전이를 허용한다', (from, to) => { expect(() => assertTermTransition(from, to)).not.toThrow(); });
  it('종료된 임기의 재활성화를 거부한다', () => { expect(() => assertTermTransition('ended', 'active')).toThrow(); });
  it('활성 임기가 있으면 명시적 종료 옵션을 요구한다', () => { expect(() => assertCanStartTerm(1, false)).toThrow(); expect(() => assertCanStartTerm(1, true)).not.toThrow(); });
});
