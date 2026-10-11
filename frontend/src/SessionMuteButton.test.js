import assert from "node:assert/strict";
import test from "node:test";
import { Mic, MicOff } from "lucide-react";
import { SessionMuteButton } from "./SessionMuteButton.js";
import { toggleSessionMuteIntent } from "./sessionAudioMute.js";

test("the rendered mic component reflects intent and dispatches its real click callback", () => {
  const mutedRef = { current: false };
  const muteStartedAtRef = { current: null };
  const unmuteClassRef = { current: null };
  let renderedMuted = false;
  const controller = {
    muted: false,
    mute() { this.muted = true; },
    unmute() { this.muted = false; },
  };
  const onToggle = () => toggleSessionMuteIntent({
    mutedRef,
    setMuted: (value) => { renderedMuted = value; },
    controller,
    warm: () => Promise.resolve(),
    muteStartedAtRef,
    unmuteClassRef,
  });
  const props = (muted) => SessionMuteButton({
    muted,
    onToggle,
    className: "hud-btn mic-mute-btn",
  }).props;

  const activeButton = props(renderedMuted);
  assert.equal(activeButton["aria-pressed"], false);
  assert.equal(activeButton["aria-label"], "Mute microphone");
  assert.equal(activeButton.disabled, undefined);
  assert.equal(activeButton.children.type, Mic);
  activeButton.onClick();

  const mutedButton = props(renderedMuted);
  assert.equal(mutedRef.current, true);
  assert.equal(mutedButton["aria-pressed"], true);
  assert.equal(mutedButton["aria-label"], "Unmute microphone");
  assert.equal(mutedButton.children.type, MicOff);
  mutedButton.onClick();

  assert.equal(mutedRef.current, false);
  assert.equal(renderedMuted, false);
  assert.equal(controller.muted, false);
});
