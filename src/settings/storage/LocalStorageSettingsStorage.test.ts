import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageSettingsStorage } from "./LocalStorageSettingsStorage";

describe("LocalStorageSettingsStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a value", async () => {
    const storage = new LocalStorageSettingsStorage("duck.test");
    await storage.save({ columns: 4 });
    expect(await storage.load()).toEqual({ columns: 4 });
  });

  it("returns null when nothing is stored", async () => {
    expect(await new LocalStorageSettingsStorage("duck.test").load()).toBeNull();
  });

  it("returns null for corrupted JSON instead of throwing", async () => {
    window.localStorage.setItem("duck.test", "{not json");
    expect(await new LocalStorageSettingsStorage("duck.test").load()).toBeNull();
  });
});
