"use client"
import { ShieldCheck, Users, Plus, Copy } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { FilterRow, Input, PageScaffold } from '@/components/pageScaffold';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import type { User_Full_Audit, DashboardRoleUsers, Fine, Remittance, ReconciliationRun, Ticketer_Location_Assignment } from '@/types/types';
import { formatMoney } from '@/lib/utils';
import { useState, useMemo, useEffect} from 'react';
import { Drawer } from '@/components/Drawer';
import { ResponsiveDrawerShell } from '@/components/ResponsiveDrawerShell';
import { Badge } from '@/components/Badge';
import api from '@/lib/axios';
import { toast } from 'react-toastify';
import axios from 'axios';
import type{  Roles } from '@prisma/client';

export interface RegToken {
  id: string;
  role: Roles;
  created_at: string | Date;
  issued_by: string;
  token: string;
  is_used: boolean;
  expires_at: string | Date | null;
}

export default function UsersPage({ regToken }: { regToken: RegToken[] }) {
   const [selected, setSelected] = useState<User_Full_Audit | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [scope, setScope] = useState<'ALL' | DashboardRoleUsers>('ALL');
  const [regTokens, setRegTokens] = useState<RegToken[]>(regToken ?? []);
  const [role, setRole] = useState<Roles>("TICKETER");
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User_Full_Audit[]>([]);
  const [loading, setLoading] = useState(true);

  // 💡 Fetch active users from DB on mount


  // 💡 Fetch active users from DB on mount
  useEffect(() => {
    let ignore = false;

    api.get("/admin/user")
      .then((res) => {
        if (res.data?.success && !ignore) {
          setUsers(res.data.data);
        }
      })
      .catch((err) => {
        if(err instanceof axios.AxiosError)
        toast.error(err?.response?.data.message || "Error loading users");
        else
        toast.error("Error loading users");
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

      // 💡 Fetch active onboarding tokens
    api.get("/regtoken")
      .then((res) => {
        if (res.data?.success && !ignore) {
          setRegTokens(res.data.tokens);
        }
      })
      .catch((err) => {
        if(err instanceof axios.AxiosError)
        toast.error(err?.response?.data.message || "Failed to load registration tokens");
        else
        toast.error("Failed to load registration tokens");
      });

    return () => {
      ignore = true;
    };
  }, []);

const copyToClipboard = (text: string) => {
  if (typeof window !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Token copied to clipboard"))
      .catch(() => toast.error("Clipboard copy failed"));
  } 
};

const generateRegToken = async () => {
    try {
      const res = await api.post("/regtoken", { role });
      // 💡 Wrap/Format the raw token response so it matches the RegToken interface
      const newToken: RegToken = {
        id: res.data.token,
        token: res.data.token,
        role: role,
        created_at: new Date(),
        is_used: false,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        issued_by: ""
      };
      setRegTokens(prev => [newToken, ...prev]);
      setOpen(false);
      toast.success("Token generated successfully");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message || "An error occurred");
      } else {
        toast.error("An unexpected error occurred");
      }
    }
  };

  const columns: ColumnDef<User_Full_Audit>[] = [
    { 
      id: 'fullname', 
      header: 'full name', 
      cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.username}</span> 
    },
    { 
      id: 'role', 
      header: 'role', 
      cell: (r) => <span className="text-slate-500 text-xs">{r?.role}</span>, 
      sortValue: (r) => r?.role 
    },
    { 
      id: 'phone', 
      header: 'phone number', 
      cell: (r) => <span className="text-slate-500 text-xs">{r?.phone || '—'}</span>, 
      sortValue: (r) => r?.phone || "" 
    },
  ];


  const rows = users;
  const uniqueRoles = new Set(users.map((user) => user.role));
  const totalRoles = uniqueRoles.size;

  const filtered = useMemo(() => {
    return rows.filter((r) => (scope === 'ALL' ? true : r.role === scope));
  }, [rows, scope]);

const rolesToMap: Roles[] = ['TICKETER', 'SUPERVISOR', 'ADMIN', 'AUDITOR'];


  return (
    <>
      <PageScaffold
        title="Admin • Users"
        subtitle="RBAC administration surface (no financial edits)"
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Users" value={users.length.toString()} icon={<Users className="text-blue-300" />} iconBg="bg-blue-500/10" />
            <StatCard title="Roles" value={totalRoles.toString()} icon={<ShieldCheck className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
            <StatCard title="Policy" value="RBAC" icon={<ShieldCheck className="text-purple-300" />} iconBg="bg-purple-500/10" />
            <StatCard title="Audit" value="Enabled" icon={<ShieldCheck className="text-amber-300" />} iconBg="bg-amber-500/10" />
          </div>
        }
      >
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold tracking-tight">Registration Token</h2>

          <div className="flex items-center gap-4">
            {regTokens.map((token) => (
              <div
                key={token?.id ?? token.token}
                className="flex items-center gap-2 cursor-pointer border border-white/5 bg-white/5 rounded-full px-3 py-1 hover:bg-white/10"
                onClick={() => {
                  copyToClipboard(token.token);
                }}
                title="copy token"
              >
                <span className="text-slate-300 text-xs font-mono">{token.token}
                  <p className="text-slate-500 text-xs text-center">{token.role}</p>
                </span>
                
                <Copy className="size-3 text-slate-500" />
              </div>
            ))}
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="glass-button flex items-center gap-2 cursor-pointer w-fit border border-gray-700 rounded-full px-2 py-1 lg:px-3 lg:py-1 bg-gray-800/50"
          >
            <Plus className="size-3 lg:size-4" />
            <span className="text-white font-bold tracking-tight text-xs lg:text-sm">generate new Token</span>
          </button>
        </div>

        <div className="rounded-3xl border border-white/5 p-6">
          <div className="text-slate-500 text-sm mt-2">
            <FilterRow>
              <Input value={searchInput} onChange={setSearchInput} placeholder="Search by user_id / username / email" />
            </FilterRow>
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              </div>
            ) : (
              <DataTable
                rows={filtered}
                columns={columns}
                getRowId={(r) => r.user_id}
                onRowClick={(r) => setSelected(r)}
                searchValue={searchInput}
                searchPredicate={(r, qq) =>
                  r.user_id.toLowerCase().includes(qq) ||
                  r.username.toLowerCase().includes(qq) ||
                  r.email.toLowerCase().includes(qq)
                }
              />
            )}
          </div>
        </div>
      </PageScaffold>

      <Drawer
        open={Boolean(open)}
        title="Generate Registration Token"
        subtitle="Create a temporary onboarding token for a staff role."
        onClose={() => setOpen(false)}
      >
        <div className="glass-panel rounded-3xl border border-white/10 p-5 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Select Role</label>
            <div className="grid grid-cols-2 gap-3">
              {rolesToMap.map((staffRole) => (
                <button
                  key={staffRole}
                  onClick={() => setRole(staffRole)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                    role === staffRole
                      ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {staffRole}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Token Expiry</label>
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300">
              1 Hour Expiration
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-200 leading-relaxed">
              Generated tokens can only be used once and will automatically expire after the configured duration.
            </p>
          </div>

          <button
            disabled={!role}
            onClick={generateRegToken}
            className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 transition-all"
          >
            Generate Token
          </button>
        </div>
      </Drawer>

      <Drawer
        open={Boolean(selected)}
        title={selected ? `User Profile` : 'User Profile'}
        subtitle={selected ? `${selected.role} • Joined ${selected.created_at ? new Date(selected.created_at).toLocaleDateString() : "—"}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-6">
            <ResponsiveDrawerShell
              title={selected.username}
              subtitle={`${selected.role} • ${selected.user_id}`}
              badge={<Badge variant={selected.restricted ? "danger" : "info"}>{selected.restricted ? "RESTRICTED" : selected.role}</Badge>}
              stats={[
                { label: 'Address', value: selected.address ?? '—' },
                { label: 'Phone', value: selected.phone ?? '—' },
                {
                  label: 'Fines',
                  value: formatMoney(selected?.fines?.reduce((acc, fine) => acc + fine.amount, 0) || 0),
                  tone: (selected?.fines?.reduce((acc, fine) => acc + fine.amount, 0) || 0) > 0 ? 'danger' : 'success',
                },
                {
                  label: 'Shortages',
                  value: String(selected?.reconciliation?.length || 0),
                  tone: (selected?.reconciliation?.length || 0) > 0 ? 'warning' : 'success',
                },
              ]}
                           fields={[
                { label: 'User ID', value: selected.user_id },
                { label: 'Email', value: selected.email },
                { label: 'Phone', value: selected.phone ?? '—' },
                { label: 'Supervisor', value: selected.supervisor ?? '—' },
                { label: 'Address', value: selected.address ?? '—' },
                { label: 'Guarantor', value: selected.guarantor ?? '—' },
                { label: 'Guarantor Phone', value: selected.guarantor_phone ?? '—' },
                { label: 'Guarantor Address', value: selected.guarantor_address ?? '—' },
                { label: 'Joined Date', value: selected.created_at ? new Date(selected.created_at).toLocaleDateString() : '—' },
              ]}

              sections={[
                {
                  title: 'Shortages',
                  content:
                    selected?.reconciliation?.length === 0 ? (
                      <p className="text-sm text-slate-500">No Variation for this User</p>
                    ) : (
                      <div className="space-y-3">
                        {selected?.reconciliation?.map((run) => (
                          <div key={run.run_id} className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Shortage</p>
                                <p className="mt-1 text-sm font-semibold text-white">{run.status}</p>
                              </div>
                              <Badge variant={run.status === 'VARIANCE' ? 'danger' : 'warning'}>{run.status}</Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Allocated</p>
                                <p className="mt-1 text-slate-200">{formatMoney(run.expected_float)}</p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Remitted</p>
                                <p className="mt-1 text-slate-200">{formatMoney(run.actual_remittance)}</p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Shortage</p>
                                <p className="mt-1 text-slate-200">{formatMoney(run.variance)}</p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Date</p>
                                <p className="mt-1 text-slate-200">{run.date}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
                },
                {
                  title: 'Fines Incurred',
                  content:
                    selected?.fines?.length === 0 ? (
                      <p className="text-sm text-slate-500">No unpaid fines for this user.</p>
                    ) : (
                      <div className="space-y-3">
                        {selected?.fines?.map((fine) => (
                          <div key={fine.id} className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{fine.reason}</p>
                                <p className="mt-1 text-xs text-slate-500">{new Date(fine.created_at).toLocaleDateString()}</p>
                              </div>
                              <Badge variant="danger">{fine.status}</Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Amount</p>
                                <p className="mt-1 text-slate-200">{formatMoney(fine.amount)}</p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Issuer</p>
                                <p className="mt-1 text-slate-200">{fine.issued_by}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
                },
              ]}
            />

            {/* 💡 BAN/RESTRICT SYSTEM ACTION BUTTON */}
            <div className="pt-4 border-t border-white/5">
              <button
                onClick={async () => {
                  try {
                    const nextStatus = !selected.restricted;
                    const res = await api.patch("/admin/user", {
                      user_id: selected.user_id,
                      restricted: nextStatus
                    });
                    if (res.data?.success) {
                      toast.success(nextStatus ? "User restricted successfully" : "User unrestricted successfully");
                      setUsers(prev => prev.map(u => u.user_id === selected.user_id ? { ...u, restricted: nextStatus } : u));
                      setSelected(prev => prev ? { ...prev, restricted: nextStatus } : null);
                    }
                  } catch (err) {
                    toast.error("Failed to update user status");
                  }
                }}
                className={`w-full py-3 rounded-2xl font-semibold transition-all border ${
                  selected.restricted
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                }`}
              >
                {selected.restricted ? "Unrestrict / Enable User" : "Restrict / Ban User"}
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
