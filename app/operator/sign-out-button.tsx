"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="underline underline-offset-4 hover:text-foreground"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
      }}
    >
      Afmelden
    </button>
  );
}
