import type { Metadata } from "next";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import { condensed } from "./fonts";
import { TvApp } from "./tv-app";

export const metadata: Metadata = { title: "TV", robots: { index: false } };

/** The venue TV. Reads this device's local competition data, so it works without internet. */
export default function TvPage() {
  return (
    <div className={condensed.variable}>
      <ServiceWorkerRegistration />
      <TvApp />
    </div>
  );
}
