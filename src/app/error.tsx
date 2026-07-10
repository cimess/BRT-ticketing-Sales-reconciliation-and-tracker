"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, RefreshCw, Home, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  const handleGoHome = () => {
    if (status === "authenticated" && session?.user?.role) {
      const role = session.user.role;
      if (role === "ADMIN" || role === "AUDITOR") {
        router.push("/dashboard/admin");
      } else if (role === "SUPERVISOR") {
        router.push("/dashboard/supervisor");
      } else if (role === "TICKETER") {
        router.push("/dashboard/ticketer");
      } else {
        router.push("/");
      }
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-xl shadow-2xl space-y-6">
        {/* Top Glow Accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertCircle className="size-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
              System Error
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
              An unexpected process exception has occurred. Our monitoring service has logged this event.
            </p>
          </div>
        </div>

        {/* Diagnostic Accordion Drawer */}
        <div className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-4 py-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            <span>Developer details</span>
            {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          
          {showDetails && (
            <div className="px-4 pb-4 pt-1 text-left space-y-2 border-t border-white/5 font-mono text-[10px] text-slate-400 select-all overflow-x-auto leading-relaxed bg-black/45 max-h-40">
              <p className="text-rose-400 font-semibold">{error?.name || "Error"}: {error?.message || "Something went wrong."}</p>
              {error?.digest && (
                <p><span className="text-slate-600">Digest Token:</span> {error.digest}</p>
              )}
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="size-3.5" /> Try Again
          </button>

          <button
            onClick={handleGoHome}
            disabled={status === "loading"}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-extrabold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
          >
            {status === "loading" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                <Home className="size-3.5" />
                {status === "authenticated" ? "Dashboard" : "Login"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
