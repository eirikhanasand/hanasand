export interface NewsFallbackBudget {
  attempts: number;
  used: number;
  limit: number;
  tryUse(): boolean;
  markUsed(): void;
}

export function createNewsFallbackBudget(queryCount: number): NewsFallbackBudget {
  const limit = Math.min(500, Math.max(25, Math.ceil(queryCount * 0.35)));
  return {
    attempts: 0,
    used: 0,
    limit,
    tryUse() {
      if (this.attempts >= this.limit) return false;
      this.attempts += 1;
      return true;
    },
    markUsed() {
      this.used += 1;
    }
  };
}
