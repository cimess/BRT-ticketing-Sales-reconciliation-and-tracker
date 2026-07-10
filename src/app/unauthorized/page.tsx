"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShieldAlert, Home, Loader2, ArrowLeft } from "lucide-react";

export default function Unauthorized() {
  const { data: session, status } = useSession();
  const router = useRouter();

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

      <div className="w-full max-w-md relative z-10 p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-xl shadow-2xl text-center space-y-6">
        {/* Top Glow Accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <ShieldAlert className="size-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 leading-tight">
            Access Denied
          </h1>
          <span className="text-[9px] font-mono tracking-widest text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-md py-1 px-3 inline-block">
            HTTP STATUS 403: FORBIDDEN
          </span>
          <p className="text-slate-500 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed pt-2">
            You do not have administrative credentials or authorization to view this segment. Please verify your login role.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.back()}
            className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>

          <button
            onClick={handleGoHome}
            disabled={status === "loading"}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-black text-xs font-extrabold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/10"
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
