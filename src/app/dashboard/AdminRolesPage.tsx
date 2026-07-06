// src/app/dashboard/AdminRolesPage.tsx
"use client";
import { useState, useEffect } from "react";
import { ShieldCheck, ToggleLeft, ToggleRight, Sparkles, BookOpen, AlertCircle } from "lucide-react";
import StatCard from "../../components/StatCard";
import { PageScaffold } from "../../components/pageScaffold";
import { useSession } from "next-auth/react";
import api from "../lib/axios";
import { Drawer } from "../../components/Drawer";

interface CommissionRule {
  id: string;
  role: string;
  percentage: number | null;
  fixed_amount: number | null;
  is_active: boolean;
}

interface CompanyRule {
  id: string;
  name: string;
  description: string | null;
  comparison_value: number;
  fine_amount: number | null;
  is_active: boolean;
}


export default function AdminRolesPage() {
  const { data: session } = useSession();
  const [commissions, setCommissions] = useState<CommissionRule[]>([]);
  const [rules, setRules] = useState<CompanyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Commission Form States
  const [commRole, setCommRole] = useState("TICKETER");
  const [commPercentage, setCommPercentage] = useState("");
  const [commFixed, setCommFixed] = useState("");
  const [isCommDrawerOpen, setIsCommDrawerOpen] = useState(false);

  // Fine Rules Form States
  const [ruleValue, setRuleValue] = useState("");
  const [ruleFine, setRuleFine] = useState("");
  const [isRuleDrawerOpen, setIsRuleDrawerOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<{
    id?: string;
    name: string;
    description: string | null;
    comparison_value: number;
    fine_amount: number;
    is_active: boolean;
    graceLabel: string;
  } | null>(null);

  useEffect(() => {
    async function loadRulesAndCommissions() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [commRes, ruleRes] = await Promise.all([
          api.get("/admin/commision-rules"),
          api.get("/admin/rules"),
        ]);
        if (commRes.data.success) setCommissions(commRes.data.rules);
        if (ruleRes.data.success) setRules(ruleRes.data.data);
      } catch (err) {
        setErrorMsg("Failed to fetch settings data.");
      } finally {
        setLoading(false);
      }
    }
    if (session?.user) {
      loadRulesAndCommissions();
    }
  }, [session]);

  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await api.post("/admin/commision-rules", {
        role: commRole,
        percentage: commPercentage ? parseFloat(commPercentage) : null,
        fixedAmount: commFixed ? parseFloat(commFixed) : null,
      });
      if (res.data.success) {
        setCommissions((prev) => {
          const filtered = prev.filter((c) => c.role !== commRole);
          return [...filtered, res.data.rule];
        });
        setIsCommDrawerOpen(false);
      }
    } catch (err) {
      setErrorMsg("Failed to save commission rate.");
    }
  };

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;
    setErrorMsg(null);

    try {
      const grace = parseFloat(ruleValue);
      const fine = parseFloat(ruleFine);

      if (selectedRule.id) {
        // Update existing rule settings
        const res = await api.put(`/admin/rules/${selectedRule.id}`, {
          is_active: selectedRule.is_active,
          comparison_value: grace,
          fine_amount: fine
        });
        if (res.data.success) {
          setRules(prev => prev.map(r => r.id === selectedRule.id ? { 
            ...r, 
            comparison_value: grace, 
            fine_amount: fine, 
            is_active: selectedRule.is_active 
          } : r));
          setIsRuleDrawerOpen(false);
        }
      } else {
        // Create new rule from template
        const res = await api.post("/admin/rules", {
          name: selectedRule.name,
          description: selectedRule.description,
          comparison_value: grace,
          fine_amount: fine
        });
        if (res.data.success) {
          setRules(prev => [...prev, res.data.data]);
          setIsRuleDrawerOpen(false);
        }
      }
    } catch (err) {
      setErrorMsg("Failed to update policy settings.");
    }
  };

  const handleToggleRule = async (id: string, active: boolean) => {
    try {
      const res = await api.put(`/admin/rules/${id}`, { is_active: !active });
      if (res.data.success) {
        setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !active } : r)));
      }
    } catch (err) {
      setErrorMsg("Failed to toggle policy status.");
    }
  };

  return (
    <PageScaffold
      title="Admin • Rules & Commission Policies"
      subtitle="Define automated ticketing commissions and company fine policy configurations"
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Commission Rules" value={String(commissions.length)} icon={<Sparkles className="text-indigo-300" />} iconBg="bg-indigo-500/10" />
          <StatCard title="Auto-Fine Policies" value={String(rules.length)} icon={<ShieldCheck className="text-red-300" />} iconBg="bg-red-500/10" />
          <StatCard title="Active Policies" value={String(rules.filter((r) => r.is_active).length)} icon={<BookOpen className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
          <StatCard title="Status Checks" value="Automated" icon={<ShieldCheck className="text-amber-300" />} iconBg="bg-amber-500/10" />
        </div>
      }
    >
      {errorMsg && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs font-mono mb-4">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <p className="p-4 text-xs text-slate-500">Loading settings...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Commission Rules Card */}
          <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4 bg-slate-900/40 lg:col-span-1">
            <p className="text-white text-sm font-bold border-b border-white/5 pb-2 uppercase tracking-wider text-slate-400">Commission Rates</p>
            <div className="space-y-3">
              {["TICKETER", "SUPERVISOR"].map((role) => {
                const activeComm = commissions.find(c => c.role === role && c.is_active);
                return (
                  <div 
                    key={role}
                    onClick={() => {
                      setCommRole(role);
                      setCommPercentage(activeComm?.percentage ? String(activeComm.percentage) : "");
                      setCommFixed(activeComm?.fixed_amount ? String(activeComm.fixed_amount) : "");
                      setIsCommDrawerOpen(true);
                    }}
                    className="group rounded-xl border border-white/5 bg-black/20 p-4 transition cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">{role === "TICKETER" ? "Ticketer" : "Supervisor"}</span>
                      <span className="text-[10px] text-indigo-400 group-hover:text-indigo-300 font-semibold uppercase tracking-wider">Configure &rarr;</span>
                    </div>
                    <p className="text-sm font-semibold text-white mt-2">
                      {activeComm?.percentage && activeComm?.fixed_amount
                        ? `${activeComm.percentage.toFixed(2)}% + ₦${Number(activeComm.fixed_amount).toLocaleString()} flat`
                        : activeComm?.percentage
                          ? `${activeComm.percentage.toFixed(2)}% of total sales`
                          : activeComm?.fixed_amount
                            ? `₦${Number(activeComm.fixed_amount).toLocaleString()} flat per shift`
                            : "No payout rule configured"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fines Rules Table Box */}
          <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4 bg-slate-900/40 lg:col-span-2">
            <div className="border-b border-white/5 pb-2">
              <p className="text-white text-sm font-bold uppercase tracking-wider text-slate-400">Automated Fines policies</p>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                           {[
                {
                  name: "Late Report Submission Policy",
                  description: "Fines ticketers who submit reports late after shift closing time.",
                  defaultGrace: 2,
                  defaultFine: 500,
                  graceLabel: "Grace Period (Hours)",
                },
                {
                  name: "Shortage Remittance Policy",
                  description: "Fines ticketers when remittance expectation is overdue.",
                  defaultGrace: 24,
                  defaultFine: 1000,
                  graceLabel: "Grace Period (Hours)",
                },
                {
                  name: "Late Bank Deposit Policy",
                  description: "Fines supervisors who delay depositing accepted cash.",
                  defaultGrace: 24,
                  defaultFine: 1000,
                  graceLabel: "Grace Period (Hours)",
                },
                {
                  name: "Supervisor Fine Authority Policy",
                  description: "Allows supervisors to manually issue fines, waive, and edit fine amounts.",
                  defaultGrace: 1,
                  defaultFine: 0,
                  graceLabel: "Authority Status",
                }
              ].map((policy) => {
                // Find rule in database by exact Name
                const rule = rules.find(r => r.name === policy.name);
                const isActive = rule?.is_active ?? false;

                return (
                  <div 
                    key={policy.name} 
                    onClick={() => {
                      setSelectedRule({
                        id: rule?.id,
                        name: policy.name,
                        description: policy.description,
                        comparison_value: rule ? rule.comparison_value : policy.defaultGrace,
                        fine_amount: rule ? (rule.fine_amount ?? 0) : policy.defaultFine,
                        is_active: isActive,
                        graceLabel: policy.graceLabel
                      });
                      setRuleValue(rule ? String(rule.comparison_value) : String(policy.defaultGrace));
                      setRuleFine(rule ? String(rule.fine_amount ?? 0) : String(policy.defaultFine));
                      setIsRuleDrawerOpen(true);
                    }}
                    className={`glass-panel p-4 rounded-xl border transition cursor-pointer hover:border-white/20 hover:bg-white/5 flex flex-col justify-between min-h-[140px] ${
                      isActive ? 'border-emerald-500/30' : 'border-white/5'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="text-white text-xs font-bold leading-tight">{policy.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">{policy.description}</p>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-white/5 text-[10px]">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider">Configure &rarr;</span>
                      {rule && (
                        <span className="text-slate-300 font-mono">
                          {rule.name === "Supervisor Fine Authority Policy" 
                            ? (rule.is_active ? "Authorized" : "Unauthorized") 
                            : `${rule.comparison_value}h grace • ₦${(rule.fine_amount ?? 0).toLocaleString()} fine`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* Commission Rate Edit Drawer */}
      <Drawer
        open={isCommDrawerOpen}
        title={`Configure ${commRole === "TICKETER" ? "Ticketer" : "Supervisor"} Commission`}
        subtitle="Set the reward percentages or flat payout rates per shift"
        onClose={() => setIsCommDrawerOpen(false)}
      >
        <form onSubmit={handleSaveCommission} className="space-y-4">
          <div>
            <label className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Percentage rate (%)</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 1.5"
              value={commPercentage}
              onChange={(e) => setCommPercentage(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Or Fixed Shift Amount (₦)</label>
            <input
              type="number"
              placeholder="e.g. 1000"
              value={commFixed}
              onChange={(e) => setCommFixed(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase rounded-xl transition"
          >
            Save Rate Settings
          </button>
        </form>
      </Drawer>

      {/* Automated Fine Policy Edit Drawer */}
      <Drawer
        open={isRuleDrawerOpen && selectedRule !== null}
        title={selectedRule?.name || "Configure Policy"}
        subtitle={selectedRule?.description || ""}
        onClose={() => setIsRuleDrawerOpen(false)}
      >
        {selectedRule && (
          <form onSubmit={handleUpdateRule} className="space-y-4">
            <div className="flex justify-between items-center rounded-xl bg-white/5 border border-white/10 p-3">
              <span className="text-xs text-slate-300 font-bold uppercase">Policy Active Status</span>
              <button
                type="button"
                onClick={() => setSelectedRule(prev => prev ? { ...prev, is_active: !prev.is_active } : null)}
                className="focus:outline-none"
              >
                {selectedRule.is_active ? (
                  <ToggleRight className="w-8 h-8 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>

                       {selectedRule.name !== "Supervisor Fine Authority Policy" && (
              <>
                <div>
                  <label className="text-[11px] text-slate-400 font-bold uppercase block mb-1">
                    {selectedRule.graceLabel}</label>
                  <input
                    required
                    type="number"
                    step="0.5"
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Fine Penalty (₦)</label>
                  <input
                    required
                    type="number"
                    value={ruleFine}
                    onChange={(e) => setRuleFine(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </>
            )}


            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-xl transition"
            >
              Save Policy Changes
            </button>
          </form>
        )}
      </Drawer>
    </PageScaffold>
  );
}
