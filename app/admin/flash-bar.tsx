"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FLASH_COOKIE } from "@/lib/flash";

/** Green confirmation at the top of the page. Gone once dismissed or after moving to another page. */
export function FlashBar({ message }: { message: string }) {
  const pathname = usePathname();
  const [shownOn] = useState(pathname);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/admin`;
  }, []);

  if (!open || pathname !== shownOn) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl bg-good-light px-[1.125rem] py-3 text-sm font-semibold text-good">
      <span className="flex-1">{message}</span>
      <button type="button" onClick={() => setOpen(false)} className="cursor-pointer hover:underline">
        Sluiten
      </button>
    </div>
  );
}
