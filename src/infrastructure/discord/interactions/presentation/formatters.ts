import { ChannelType } from 'discord.js';
import type { TermStatus } from '../../../../domain/term/lifecycle.js';

const termLabels: Record<TermStatus, string> = {
  active: '진행 중', suspended: '일시 중지', scheduled: '시작 예정',
  expired: '기간 만료', ended: '종료됨', dissolved: '해산됨'
};

export function formatTermStatus(status: TermStatus): string { return termLabels[status]; }
export function formatDraft(isDraft: boolean): string { return isDraft ? '초안' : '사용 가능'; }
export function formatRoleKind(kind: string): string { return kind === 'office' ? '직책' : kind === 'membership' ? '구성원' : '알 수 없음'; }
export function formatCardinality(value: string): string { return value === 'one' ? '1명' : value === 'many' ? '여러 명' : '알 수 없음'; }
export function formatPublicationStatus(value: { messageId: string | null; broken: boolean; lastRenderError: string | null }): string {
  if (value.broken || value.lastRenderError) return '연결 오류';
  return value.messageId ? '정상' : '게시 전';
}
export function formatSeverity(value: string): string {
  return ({ info: '안내', warning: '주의', error: '오류', critical: '심각' } as Record<string, string>)[value] ?? '알 수 없음';
}
export function formatChannelType(type: ChannelType | number | undefined): string {
  if (type === ChannelType.GuildForum) return '포럼 채널';
  if (type === ChannelType.GuildAnnouncement) return '공지 채널';
  if (type === ChannelType.GuildText) return '일반 채널';
  return '알 수 없는 채널';
}
export function discordTimestamp(value: Date | null | undefined, style: 'f' | 'R' | 'D' = 'f'): string {
  return value ? `<t:${Math.floor(value.getTime() / 1000)}:${style}>` : '없음';
}
export function formatDate(value: Date | null | undefined, locale = 'ko-KR', timeZone = 'Asia/Seoul'): string {
  return value ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone }).format(value) : '없음';
}
export function formatRelativeTime(value: Date | null | undefined): string { return discordTimestamp(value, 'R'); }
export function safeLabel(value: string, fallback = '이름 없음'): string { return (value.trim() || fallback).slice(0, 100); }
export function safeDescription(value: string): string { return value.replace(/\s+/g, ' ').trim().slice(0, 100); }
