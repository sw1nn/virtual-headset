// Per-site adapters for reading/driving the conferencing web app's mic button.
//
// These track third-party DOM that changes without notice — they're the most
// likely thing to break, so they're isolated here (free of browser/extension
// globals) and unit-tested against jsdom fixtures in ../test/adapters.test.ts.

export interface Adapter {
  /** Find the mic toggle button, or null if not present yet. */
  find(): HTMLElement | null;
  /** Whether the given button currently means "muted". */
  isMuted(el: HTMLElement): boolean;
}

export const ADAPTERS: Record<"zoom" | "meet" | "teams", Adapter> = {
  zoom: {
    // Zoom's mic button carries aria-label "mute"/"unmute"; the label names
    // the *action*, so "unmute" means it is currently muted.
    find() {
      const direct = document.querySelector<HTMLElement>(
        'button[aria-label="mute" i], button[aria-label="unmute" i]',
      );
      if (direct) return direct;
      return (
        [...document.querySelectorAll<HTMLElement>("button[aria-label]")].find(
          (b) =>
            /^(un)?mute\b/i.test((b.getAttribute("aria-label") || "").trim()),
        ) || null
      );
    },
    isMuted(el) {
      return (el.getAttribute("aria-label") || "")
        .trim()
        .toLowerCase()
        .startsWith("unmute");
    },
  },

  meet: {
    // Meet's mic button exposes data-is-muted; fall back to the aria-label
    // ("Turn on microphone" means currently off/muted).
    find() {
      const byData = document.querySelector<HTMLElement>(
        "button[data-is-muted]",
      );
      if (byData) return byData;
      return (
        [...document.querySelectorAll<HTMLElement>("button[aria-label]")].find(
          (b) => /microphone/i.test(b.getAttribute("aria-label") || ""),
        ) || null
      );
    },
    isMuted(el) {
      const dm = el.getAttribute("data-is-muted");
      if (dm != null) return dm === "true";
      return (el.getAttribute("aria-label") || "")
        .toLowerCase()
        .includes("turn on");
    },
  },

  teams: {
    // Teams has no WebHID support, so the Firefox bridge drives its own mic
    // button. The stable hook is #microphone-button with data-state="mic-off"
    // while muted; the data-tid and aria-label fallbacks cover minor UI changes.
    find() {
      const direct = document.querySelector<HTMLElement>("#microphone-button");
      if (direct) return direct;
      const byTid = document.querySelector<HTMLElement>(
        '[data-tid="toggle-mute"]',
      );
      if (byTid) return byTid;
      return (
        [...document.querySelectorAll<HTMLElement>("button[aria-label]")].find(
          (b) => /mute|microphone/i.test(b.getAttribute("aria-label") || ""),
        ) || null
      );
    },
    isMuted(el) {
      const state = el.getAttribute("data-state");
      if (state != null) {
        return ["mic-off", "muted", "off"].includes(state.toLowerCase());
      }
      const dm = el.getAttribute("data-is-muted");
      if (dm != null) return dm === "true";
      const pressed = el.getAttribute("aria-pressed");
      if (pressed != null) return pressed === "true";
      const label = (el.getAttribute("aria-label") || "").trim().toLowerCase();
      return label.startsWith("unmute") || label.includes("turn on microphone");
    },
  },
};

/** Whether hostname is exactly domain or a subdomain of it. */
function matchesHost(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

const TEAMS_HOSTS = [
  "teams.microsoft.com",
  "teams.live.com",
  "teams.cloud.microsoft",
  "teams.microsoft.us",
  "teams.microsoft.com.mcas.ms",
  "teams.microsoft.us.mcas-gov.us",
];

/** Pick the adapter for a hostname, or null if the site isn't supported. */
export function pickAdapter(hostname: string): Adapter | null {
  if (matchesHost(hostname, "zoom.us")) return ADAPTERS.zoom;
  if (hostname === "meet.google.com") return ADAPTERS.meet;
  if (TEAMS_HOSTS.some((domain) => matchesHost(hostname, domain))) {
    return ADAPTERS.teams;
  }
  return null;
}
