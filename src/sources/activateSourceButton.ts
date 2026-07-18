type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

async function defaultInvoke(
  command: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(command, args);
}

/**
 * Forwards a source button press to the Rust side, which re-resolves the
 * button's file and argv from disk — the payload only names the source and
 * button. Throws on malformed payloads so dispatch reports "failed".
 */
export async function activateSourceButton(
  payload: Record<string, unknown> | undefined,
  invoke: InvokeFn = defaultInvoke,
): Promise<void> {
  const sourceId = payload?.sourceId;
  const buttonId = payload?.buttonId;
  if (typeof sourceId !== "string" || typeof buttonId !== "string") {
    throw new Error("source:activate needs string sourceId and buttonId");
  }
  await invoke("activate_source_button", { sourceId, buttonId });
}
