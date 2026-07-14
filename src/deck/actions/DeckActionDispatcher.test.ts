import { describe, expect, it, vi } from "vitest";
import { DeckActionDispatcher } from "./DeckActionDispatcher";

describe("DeckActionDispatcher", () => {
  it("dispatches an action to its registered handler", async () => {
    const dispatcher = new DeckActionDispatcher();
    const handler = vi.fn();
    dispatcher.register("log", handler);

    const result = await dispatcher.dispatch({ type: "log", message: "hello" });

    expect(handler).toHaveBeenCalledWith({ type: "log", message: "hello" });
    expect(result.status).toBe("handled");
  });

  it("ignores undefined actions", async () => {
    const dispatcher = new DeckActionDispatcher();
    expect((await dispatcher.dispatch(undefined)).status).toBe("ignored");
  });

  it("ignores actions without a registered handler instead of throwing", async () => {
    const dispatcher = new DeckActionDispatcher();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await dispatcher.dispatch({ type: "log", message: "x" });
    expect(result.status).toBe("ignored");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reports failure without throwing when a handler throws", async () => {
    const dispatcher = new DeckActionDispatcher();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    dispatcher.register("log", () => {
      throw new Error("boom");
    });
    const result = await dispatcher.dispatch({ type: "log", message: "x" });
    expect(result.status).toBe("failed");
    expect(result.error).toBeInstanceOf(Error);
    error.mockRestore();
  });

  it("register returns an unsubscribe function", async () => {
    const dispatcher = new DeckActionDispatcher();
    const handler = vi.fn();
    const unregister = dispatcher.register("log", handler);
    unregister();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await dispatcher.dispatch({ type: "log", message: "x" });
    expect(handler).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
