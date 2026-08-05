import { ApplicationError } from '../../app/errors/application-error.js';

export type TermStatus = 'scheduled' | 'active' | 'expired' | 'ended' | 'dissolved' | 'suspended';
const transitions: Readonly<Record<TermStatus, readonly TermStatus[]>> = {
  scheduled: ['active', 'ended'], active: ['expired', 'ended', 'dissolved', 'suspended'], suspended: ['active', 'ended', 'dissolved'], expired: [], ended: [], dissolved: []
};
export function assertTermTransition(from: TermStatus, to: TermStatus): void {
  if (!transitions[from].includes(to)) throw new ApplicationError('INVALID_TERM_TRANSITION', `임기 상태를 ${from}에서 ${to}(으)로 변경할 수 없습니다.`);
}
export function assertCanStartTerm(activeCount: number, closeCurrent: boolean): void {
  if (activeCount > 0 && !closeCurrent) throw new ApplicationError('MULTIPLE_ACTIVE_TERMS', '이미 활성 임기가 있습니다. close_current 옵션으로 기존 임기를 종료해야 합니다.');
}
