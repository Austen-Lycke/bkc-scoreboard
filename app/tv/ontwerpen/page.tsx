import type { Metadata } from "next";
import { condensed } from "../fonts";
import { Gallery } from "./gallery";

export const metadata: Metadata = {
  title: "TV-ontwerpen WSA",
  robots: { index: false },
};

/** Mockups for an Olympic-style WSA TV screen, to choose from. Made-up data, nothing live. */
export default function TvDesignsPage() {
  return (
    <div className={`${condensed.variable} flex min-h-full flex-1 flex-col`}>
      <Gallery />
    </div>
  );
}
