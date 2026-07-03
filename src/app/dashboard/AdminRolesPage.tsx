// src/app/dashboard/AdminRolesPage.tsx
"use client";
import { useState, useEffect } from "react";
import { ShieldCheck, Plus, Trash2, ToggleLeft, ToggleRight, Sparkles, BookOpen, AlertCircle } from "lucide-react";
import StatCard from "../../components/StatCard";
import { PageScaffold, FilterRow, Input } from "../../components/pageScaffold";
import { Badge } from "../../components/Badge";
import { useSession } from "next-auth/react";
import api from "../lib/axios";
import axios from "axios";

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
  trigger: string;
  target_field: string;
  operator: string;
  comparison_value: number;
  fine_amount: number;
  is_active: boolean;
}

export default function AdminRolesPage() {
  const { data: session } = useSession();
  const [commissions, setCommissions] = useState<CommissionRule[]>([]);
  const [rules, setRules] = useState<CompanyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form States for Commission Rule
  const [commRole, setCommRole] = useState("TICKETER");
  const [commPercentage, setCommPercentage] = useState("");
  const [commFixed, setCommFixed] = useState("");

  // Form States for Company (Fine) Rule
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [ruleTrigger, setRuleTrigger] = useState("ON_REPORT_SUBMISSION");
  const [ruleField, setRuleField] = useState("shortage_amount");
  const [ruleOperator, setRuleOperator] = useState(">");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleFine, setRuleFine] = useState("");

  const [showRuleModal, setShowRuleModal] = useState(false);

  useEffect(() => {
    async function loadRulesAndCommissions() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [commRes, ruleRes] = await Promise.all([
          api.get("/admin/commissions"),
          api.get("/admin/rules"),
        ]);
        if (commRes.data.success) setCommissions(commRes.data.data);
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
      const res = await api.post("/admin/commissions", {
        role: commRole,
        percentage: commPercentage ? parseFloat(commPercentage) / 100 : null,
        fixed_amount: commFixed ? parseFloat(commFixed) : null,
      });
      if (res.data.success) {
        setCommissions((prev) => {
          const filtered = prev.filter((c) => c.role !== commRole);
          return [...filtered, res.data.data];
        });
        setCommPercentage("");
        setCommFixed("");
      }
    } catch (err) {
      setErrorMsg("Failed to save commission rate.");
    }
  };

  const handleToggleCommission = async (id: string, active: boolean) => {
    try {
      const res = await api.put(`/admin/commissions/${id}`, { is_active: !active });
      if (res.data.success) {
        setCommissions((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !active } : c)));
      }
    } catch (err) {
      setErrorMsg("Failed to toggle commission rule status.");
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await api.post("/admin/rules", {
        name: ruleName,
        description: ruleDesc,
        trigger: ruleTrigger,
        target_field: ruleField,
        operator: ruleOperator,
        comparison_value: parseFloat(ruleValue),
        fine_amount: parseFloat(ruleFine),
      });
      if (res.data.success) {
        setRules((prev) => [res.data.data, ...prev]);
        setShowRuleModal(false);
        setRuleName("");
        setRuleDesc("");
        setRuleValue("");
        setRuleFine("");
      }
    } catch (err) {
      setErrorMsg("Failed to create automated fine policy.");
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

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    try {
      const res = await api.delete(`/admin/rules/${id}`);
      if (res.data.success) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      setErrorMsg("Failed to delete policy.");
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commission Setting Box */}
        <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4 bg-slate-900/40 lg:col-span-1">
          <p className="text-white text-sm font-bold border-b border-white/5 pb-2 uppercase tracking-wider text-slate-400">Commission Rates</p>
          <form onSubmit={handleSaveCommission} className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Target Role</label>
              <select
                value={commRole}
                onChange={(e) => setCommRole(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="TICKETER">Ticketer</option>
                <option value="SUPERVISOR">Supervisor</option>
              </select>
            </div>
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
              Update Payout Rule
            </button>
          </form>

          {/* Current commissions list */}
          <div className="space-y-2 pt-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Configured Rates</p>
            {loading ? (
              <p className="text-xs text-slate-500">Loading...</p>
            ) : commissions.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No commission definitions found.</p>
            ) : (
              commissions.map((comm) => (
                <div key={comm.id} className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-xs font-bold text-slate-300">{comm.role}</span>
                    <span className="text-[10px] text-slate-500 block">
                      {comm.percentage ? `${(comm.percentage * 100).toFixed(2)}%` : `₦${comm.fixed_amount}`}
                    </span>
                  </div>
                  <button onClick={() => handleToggleCommission(comm.id, comm.is_active)}>
                    {comm.is_active ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fines Rules Table Box */}
        <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4 bg-slate-900/40 lg:col-span-2">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <p className="text-white text-sm font-bold uppercase tracking-wider text-slate-400">Automated Fines policies</p>
            <button
              onClick={() => setShowRuleModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-xl transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Policy
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
            {loading ? (
              <p className="p-4 text-xs text-slate-500">Loading...</p>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 italic">No automated fine rules are active yet.</div>
            ) : (
              <table className="w-full text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left text-slate-400 uppercase tracking-widest text-[9px] font-bold">
                    <th className="px-3 py-2.5">Policy Name</th>
                    <th className="px-3 py-2.5">Condition</th>
                    <th className="px-3 py-2.5">Penalty</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-3 py-3">
                        <span className="font-semibold text-slate-200 block">{rule.name}</span>
                        <span className="text-[10px] text-slate-500 block truncate max-w-xs">{rule.description || "No description"}</span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[10px]">
                        <span className="text-emerald-400">{rule.trigger}</span>: {rule.target_field} {rule.operator} {rule.comparison_value}
                      </td>
                      <td className="px-3 py-3 text-red-300 font-semibold">₦{rule.fine_amount.toLocaleString()}</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => handleToggleRule(rule.id, rule.is_active)}>
                          {rule.is_active ? (
                            <ToggleRight className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Slide-over Modal Dialog for Fine Rule */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-white font-bold text-sm">Create New Auto-Fine Policy</span>
              <button onClick={() => setShowRuleModal(false)} className="text-slate-500 hover:text-white text-xs">Cancel</button>
            </div>
            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Policy name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Shortage Penalty"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Trigger Event</label>
                <select
                  value={ruleTrigger}
                  onChange={(e) => setRuleTrigger(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ON_REPORT_SUBMISSION">On Sales Report Submission</option>
                  <option value="ON_SHIFT_VERIFICATION">On Shift Verification</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Field</label>
                  <select
                    value={ruleField}
                    onChange={(e) => setRuleField(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="shortage_amount">shortage</option>
                    <option value="variance">variance</option>
                    <option value="total_sold">sales</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Operator</label>
                  <select
                    value={ruleOperator}
                    onChange={(e) => setRuleOperator(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value=">">&gt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="==">==</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Threshold Value</label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 500"
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Auto fine Amount (₦)</label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1000"
                  value={ruleFine}
                  onChange={(e) => setRuleFine(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Description</label>
                <textarea
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none h-14"
                  placeholder="Reason for issuance..."
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-xl transition"
              >
                Activate fine rule
              </button>
            </form>
          </div>
        </div>
      )}
    </PageScaffold>
  );
}
