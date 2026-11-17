import { Bricolage_Grotesque } from "next/font/google";

/**
 * Bricolage with its width axis, for the condensed type of the WSA board (`COND` in parts/frame).
 * Only loaded on the TV pages; self-hosted by next/font, so the service worker caches it for offline.
 */
export const condensed = Bricolage_Grotesque({
  variable: "--font-tv-cond",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});
