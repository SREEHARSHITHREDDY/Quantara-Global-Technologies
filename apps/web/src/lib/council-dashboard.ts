/** Pure helpers for the council dashboard. */
export const percentOf = (used: number, budget: number | null): number | null => (budget && budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : null);
export const compact = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n));
export const usd = (n: number): string => `$${n.toFixed(n < 1 ? 4 : 2)}`;
