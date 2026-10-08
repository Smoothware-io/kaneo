import { create } from "zustand";

export type ReasonPromptKind = "blocked" | "cancel" | "delete";

export type ReasonPromptResult = {
  reason: string;
  blockedOnUserId: string | null;
};

export type ReasonPromptTarget = {
  title: string;
  // Prefilled values when editing details that already exist.
  reason?: string | null;
  blockedOnUserId?: string | null;
  // Several tasks at once (bulk delete); the title is then unused.
  count?: number;
};

type PendingPrompt = {
  kind: ReasonPromptKind;
  target: ReasonPromptTarget;
  resolve: (result: ReasonPromptResult | null) => void;
};

type TaskReasonPromptState = {
  queue: PendingPrompt[];
  request: (
    kind: ReasonPromptKind,
    target: ReasonPromptTarget,
  ) => Promise<ReasonPromptResult | null>;
  settle: (result: ReasonPromptResult | null) => void;
};

// Lets any status change or delete ask for its reason through the single
// dialog mounted in the dashboard layout, instead of every entry point
// owning one.
const useTaskReasonPromptStore = create<TaskReasonPromptState>((set, get) => ({
  queue: [],
  request: (kind, target) =>
    new Promise((resolve) => {
      set((state) => ({ queue: [...state.queue, { kind, target, resolve }] }));
    }),
  settle: (result) => {
    const [current, ...rest] = get().queue;
    if (!current) return;
    set({ queue: rest });
    current.resolve(result);
  },
}));

export default useTaskReasonPromptStore;
