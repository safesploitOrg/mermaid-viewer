import test from "node:test";
import assert from "node:assert/strict";

import {
  FRAME_MESSAGE_SOURCE,
  createChannelId,
  isExpectedFrameMessage,
} from "../public/assets/js/protocol.js";

test("channel IDs are unique enough for renderer sessions", () => {
  const first = createChannelId();
  const second = createChannelId();

  assert.notEqual(first, second);
  assert.match(first, /^[0-9a-f-]{36}$/i);
});

test("accepts a renderer message only from the expected iframe and channel", () => {
  const iframeWindow = {};
  const data = {
    source: FRAME_MESSAGE_SOURCE,
    channel: "abc123",
    type: "rendered",
  };

  assert.equal(
    isExpectedFrameMessage({
      eventSource: iframeWindow,
      expectedWindow: iframeWindow,
      data,
      channel: "abc123",
    }),
    true,
  );
});

test("rejects messages with the wrong source window, marker or channel", () => {
  const iframeWindow = {};

  assert.equal(
    isExpectedFrameMessage({
      eventSource: {},
      expectedWindow: iframeWindow,
      data: { source: FRAME_MESSAGE_SOURCE, channel: "abc123" },
      channel: "abc123",
    }),
    false,
  );

  assert.equal(
    isExpectedFrameMessage({
      eventSource: iframeWindow,
      expectedWindow: iframeWindow,
      data: { source: "other", channel: "abc123" },
      channel: "abc123",
    }),
    false,
  );

  assert.equal(
    isExpectedFrameMessage({
      eventSource: iframeWindow,
      expectedWindow: iframeWindow,
      data: { source: FRAME_MESSAGE_SOURCE, channel: "wrong" },
      channel: "abc123",
    }),
    false,
  );
});
