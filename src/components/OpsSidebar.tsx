"use client"
import { Activity, BookOpen, ClipboardList, Coins, FileText, LayoutDashboard, ShieldCheck, Smartphone } from 'lucide-react';
import { moduleHref, modulesForRole, } from '../app/lib/modules';
import type { ModuleItem } from '../app/lib/modules';
import { useRouter, usePathname, redirect } from "next/navigation";
import { useSession } from "next-auth/react"
import { useEffect } from 'react';
import { Roles } from '@prisma/client';
import { Role } from '../app/lib/modules';

const groupIcon: Record<ModuleItem['group'], React.ReactNode> = {
  Operations: <ClipboardList className="w-4 h-4" strokeWidth={1.5} />,
  Reconciliation: <Activity className="w-4 h-4" strokeWidth={1.5} />,
  Earnings: <Coins className="w-4 h-4" strokeWidth={1.5} />,
  Devices: <Smartphone className="w-4 h-4" strokeWidth={1.5} />,
  Audit: <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />,
  Reports: <FileText className="w-4 h-4" strokeWidth={1.5} />,
  Admin: <BookOpen className="w-4 h-4" strokeWidth={1.5} />,
};



export function OpsSidebar(
  {
    collapsed = false,
    onToggleCollapse,
    onCloseMobile,
  }: {

    collapsed?: boolean;
    onToggleCollapse?: () => void;
    onCloseMobile?: () => void;
  }
) {

  const navigate = useRouter();
  const pathname = usePathname();
  // Destructure session data and state from client hook
  const { data: session, status } = useSession();

  const role = session?.user?.role as Roles;
  const userRole = role?.toLowerCase() as Role;
  const items = modulesForRole(userRole);

  // Handle redirection safely using a useEffect hook instead of server-side redirect()
  useEffect(() => {
    if (status === "unauthenticated") {
      navigate.push("/");
    }
  }, [status, navigate]);

  // Show a dark skeletal frame while NextAuth verifies cookies on initial load
  if (status === "loading") {
    return <aside className="h-full w-72 bg-black/80 border-r border-white/10 animate-pulse" />;
  }


  if (!session?.user?.role) {
    redirect("/")

  }


  const grouped = items.reduce((acc, m) => {
    (acc[m.group] ||= []).push(m);
    return acc;
  }, {} as Record<ModuleItem['group'], ModuleItem[]>);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className={`h-full bg-black/80 backdrop-blur-xl border-r border-white/10 ${collapsed ? 'w-20' : 'w-72'} transition-all duration-300 ease-in-out zoom-100`}>
      <div className="h-14 px-3 flex items-center justify-between border-b border-white/10">
        <button
          className="flex items-center gap-3 min-w-0 cursor-pointer"
          onClick={() => {
            navigate.push(moduleHref(userRole, '/'));
            onCloseMobile?.();
          }}
        >

          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate">Ops Dashboard</p>
              <p className="text-slate-500 text-[11px] truncate">{session?.user?.name}</p>
            </div>
          )}

        </button>
        {/* onToggleCollapse && */}
        {onToggleCollapse && (
          <button
            className="hidden lg:inline-flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar"
          >
            <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <nav className="p-2 overflow-y-auto h-[calc(100vh-3.5rem)] scrollbar-hide">
        {(
          Object.entries(grouped) as Array<[ModuleItem['group'], ModuleItem[]]>
        ).map(([group, mods]) => (
          <div key={group} className="mb-5">
            <div className={`px-2 py-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
              <span className="text-slate-600">{groupIcon[group]}</span>
              {/* colapse */}
              {!collapsed && <span>{group}</span>}
            </div>

            <ul className="space-y-1">
              {mods.map((m) => {
                const href = moduleHref(userRole, m.path);
                const active = isActive(href);
                return (
                  <li key={m.key}>
                    <button
                      onClick={() => {
                        navigate.push(href);
                        onCloseMobile?.();
                      }}
                      title={collapsed ? m.label : undefined}
                      className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 text-sm transition-colors ${active ? 'bg-white/5 border border-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                        } ${collapsed ? 'justify-center' : ''}`}
                    >
                      <span className="size-5 flex items-center justify-center text-slate-500">
                        <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />
                      </span>
                      {!collapsed && <span className="font-semibold tracking-tight truncate">{m.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}