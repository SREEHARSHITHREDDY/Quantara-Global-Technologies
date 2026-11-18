/** Execution states used by the council. (The database enum also has RUNNING and AWAITING_APPROVAL; the council does not use them.) */
export const EXECUTION_STATES = [
  "QUEUED", "CLASSIFYING", "ASSESSING", "REVIEWING", "CONSOLIDATING",
  "SUCCEEDED", "PARTIALLY_SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT",
] as const;
export type ExecutionState = (typeof EXECUTION_STATES)[number];

export const TERMINAL_STATES: readonly ExecutionState[] = ["SUCCEEDED", "PARTIALLY_SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"];
export const ACTIVE_STATES: readonly ExecutionState[] = ["QUEUED", "CLASSIFYING", "ASSESSING", "REVIEWING", "CONSOLIDATING"];
/** Forward pipeline order, used to resume without repeating finished stages. */
export const PIPELINE: readonly ExecutionState[] = ["QUEUED", "CLASSIFYING", "ASSESSING", "REVIEWING", "CONSOLIDATING"];

const ABORT: ExecutionState[] = ["FAILED", "CANCELLED", "TIMED_OUT"];
const NEXT: Record<ExecutionState, ExecutionState[]> = {
  QUEUED: ["CLASSIFYING", ...ABORT],
  CLASSIFYING: ["ASSESSING", ...ABORT],
  ASSESSING: ["REVIEWING", ...ABORT],
  REVIEWING: ["CONSOLIDATING", ...ABORT],
  CONSOLIDATING: ["SUCCEEDED", "PARTIALLY_SUCCEEDED", ...ABORT],
  SUCCEEDED: [], PARTIALLY_SUCCEEDED: [], FAILED: [], CANCELLED: [], TIMED_OUT: [],
};

export const isTerminal = (s: ExecutionState) => TERMINAL_STATES.includes(s);
export const canTransition = (from: ExecutionState, to: ExecutionState) => NEXT[from].includes(to);

export class InvalidTransitionError extends Error {
  constructor(readonly from: string, readonly to: string) { super(`invalid execution transition ${from} -> ${to}`); this.name = "InvalidTransitionError"; }
}
export function assertTransition(from: ExecutionState, to: ExecutionState): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
