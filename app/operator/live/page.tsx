import type { Metadata } from "next";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import { OperatorApp } from "./operator-app";

export const metadata: Metadata = { title: "Wedstrijd", robots: { index: false } };

/** Static shell: everything is loaded from this device's storage, so it also works offline. */
export default function OperatorLivePage() {
  return (
    <>
      <ServiceWorkerRegistration />
      <OperatorApp />
    </>
  );
}
