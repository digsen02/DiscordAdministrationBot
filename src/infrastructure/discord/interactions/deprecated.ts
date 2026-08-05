export const deprecatedCommands: Readonly<Record<string, { command: string; panel: string }>> = {
  'org-role': { command: '/org-role', panel: '/org manage → 역할' },
  'org-field': { command: '/org-field', panel: '/org manage → 사용자 정의 필드' },
  classification: { command: '/classification', panel: '/org manage → 분류' },
  'classification-option': { command: '/classification-option', panel: '/org manage → 분류' },
  'term:pause': { command: '/term pause', panel: '/term manage → 일시 중지' },
  'term:resume': { command: '/term resume', panel: '/term manage → 재개' },
  'term:end': { command: '/term end', panel: '/term manage → 종료' },
  'template:import': { command: '/template import', panel: '/template create → 파일 가져오기' },
  'publication:publish': { command: '/publication publish', panel: '/publication manage → 게시' },
  'publication:repair': { command: '/publication repair', panel: '/publication manage → 복구·재연결' },
  'publication:delete': { command: '/publication delete', panel: '/publication manage → 설정 삭제' }
};
