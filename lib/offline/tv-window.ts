"use client";

interface ScreenDetailed extends Screen {
  availLeft: number;
  availTop: number;
}

/**
 * Opens the TV screen as a separate window, on the second screen (TV via HDMI) when the browser
 * supports the Window Management API (Chrome). The TV page then goes fullscreen with one click.
 */
export async function openTvWindow(competitionId: string) {
  const url = `/tv?c=${encodeURIComponent(competitionId)}`;
  let features = "popup,width=1280,height=720";
  try {
    if ("getScreenDetails" in window) {
      const details = await (window as unknown as {
        getScreenDetails(): Promise<{ screens: ScreenDetailed[]; currentScreen: ScreenDetailed }>;
      }).getScreenDetails();
      const other = details.screens.find((s) => s !== details.currentScreen);
      if (other) {
        features = `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
      }
    }
  } catch {
    // Permission denied or unsupported: open a normal window the operator drags to the TV.
  }
  window.open(url, "bkc-tv", features);
}
