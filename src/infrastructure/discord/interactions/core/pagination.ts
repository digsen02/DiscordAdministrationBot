export const DISCORD_LIMITS = { buttonsPerRow: 5, rows: 5, selectOptions: 25, modalFields: 5, messageLength: 2000, forumTags: 5 } as const;

export function pageOf<T>(items: readonly T[], page: number, size = 10): { items: T[]; page: number; pages: number } {
  const safeSize = Math.max(1, Math.min(size, DISCORD_LIMITS.selectOptions));
  const pages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.max(0, Math.min(Math.trunc(page), pages - 1));
  return { items: items.slice(safePage * safeSize, (safePage + 1) * safeSize), page: safePage, pages };
}

export function truncateMessage(value: string): string {
  return value.length <= DISCORD_LIMITS.messageLength ? value : `${value.slice(0, DISCORD_LIMITS.messageLength - 14)}\n…(일부 생략)`;
}
