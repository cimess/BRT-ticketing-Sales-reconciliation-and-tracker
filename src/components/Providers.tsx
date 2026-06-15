// src/components/Providers.tsx
"use client"; // Must be at the very top

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Session } from "next-auth";

export function Providers({ children,session }: { children: ReactNode,session:Session |null }) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}
