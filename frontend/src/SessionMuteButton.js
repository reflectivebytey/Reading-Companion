import { createElement } from "react";
import { motion as Motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

export function SessionMuteButton({ muted, onToggle, className, whileTap, transition }) {
  return createElement(
    Motion.button,
    {
      type: "button",
      className,
      whileTap,
      transition,
      onClick: onToggle,
      "aria-pressed": muted,
      "aria-label": muted ? "Unmute microphone" : "Mute microphone",
      title: muted ? "Unmute microphone" : "Mute microphone",
    },
    createElement(muted ? MicOff : Mic, { size: 22 }),
  );
}
