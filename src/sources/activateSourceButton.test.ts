import { describe, expect, it, vi } from "vitest";
import { activateSourceButton } from "./activateSourceButton";

describe("activateSourceButton", () => {
  it("invokes the Rust command with the payload's ids", async () => {
    const invoke = vi.fn(async () => undefined);
    await activateSourceButton({ sourceId: "s0", buttonId: "s0:corgi-30" }, invoke);
    expect(invoke).toHaveBeenCalledWith("activate_source_button", {
      sourceId: "s0",
      buttonId: "s0:corgi-30",
    });
  });

  it("rejects payloads without string ids, without invoking", async () => {
    const invoke = vi.fn(async () => undefined);
    await expect(activateSourceButton(undefined, invoke)).rejects.toThrow();
    await expect(activateSourceButton({ sourceId: "s0" }, invoke)).rejects.toThrow();
    await expect(
      activateSourceButton({ sourceId: 0, buttonId: "s0:x" }, invoke),
    ).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("propagates command failures", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("spawn failed");
    });
    await expect(
      activateSourceButton({ sourceId: "s0", buttonId: "s0:x" }, invoke),
    ).rejects.toThrow("spawn failed");
  });
});
