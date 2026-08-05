export class RefreshQueue {
  private readonly pending = new Map<number, ReturnType<typeof setTimeout>>();
  constructor(private readonly refresh: (publicationId: number) => Promise<void>, private readonly delayMs = 5_000, private readonly onError: (error: unknown, publicationId: number) => void = () => undefined) {}
  enqueue(publicationId: number): void {
    const existing = this.pending.get(publicationId); if (existing) clearTimeout(existing);
    this.pending.set(publicationId, setTimeout(() => { this.pending.delete(publicationId); void this.refresh(publicationId).catch((error: unknown) => this.onError(error, publicationId)); }, this.delayMs));
  }
  cancelAll(): void { this.pending.forEach((timer) => clearTimeout(timer)); this.pending.clear(); }
  get size(): number { return this.pending.size; }
}
