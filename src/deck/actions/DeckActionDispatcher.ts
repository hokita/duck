import type { DeckButtonAction } from "./DeckAction";

export interface DispatchResult {
  status: "handled" | "ignored" | "failed";
  error?: unknown;
}

type AnyHandler = (action: DeckButtonAction) => void | Promise<void>;

export class DeckActionDispatcher {
  private readonly handlers = new Map<DeckButtonAction["type"], AnyHandler>();

  register<T extends DeckButtonAction["type"]>(
    type: T,
    handler: (action: Extract<DeckButtonAction, { type: T }>) => void | Promise<void>,
  ): () => void {
    const anyHandler = handler as AnyHandler;
    this.handlers.set(type, anyHandler);
    return () => {
      if (this.handlers.get(type) === anyHandler) {
        this.handlers.delete(type);
      }
    };
  }

  async dispatch(action: DeckButtonAction | undefined): Promise<DispatchResult> {
    if (!action) {
      return { status: "ignored" };
    }
    const handler = this.handlers.get(action.type);
    if (!handler) {
      console.warn(`[deck] no handler registered for action type "${action.type}"`);
      return { status: "ignored" };
    }
    try {
      await handler(action);
      return { status: "handled" };
    } catch (error) {
      console.error(`[deck] action "${action.type}" failed`, error);
      return { status: "failed", error };
    }
  }
}
