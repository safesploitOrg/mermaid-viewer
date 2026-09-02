export const PARENT_MESSAGE_SOURCE = "mermaid-viewer-parent";
export const FRAME_MESSAGE_SOURCE = "mermaid-viewer-renderer";

export function createChannelId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isExpectedFrameMessage({
  eventSource,
  expectedWindow,
  data,
  channel,
}) {
  return Boolean(
    expectedWindow
      && eventSource === expectedWindow
      && data
      && typeof data === "object"
      && data.source === FRAME_MESSAGE_SOURCE
      && data.channel === channel,
  );
}
