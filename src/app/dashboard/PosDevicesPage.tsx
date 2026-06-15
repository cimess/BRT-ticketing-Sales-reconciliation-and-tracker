"use client"
import React, { useState, useMemo } from 'react';
import { Smartphone, Plus, Send } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import { Drawer } from '@/components/Drawer';
import api from '@/lib/axios';
import { toast } from 'react-toastify';
import axios from 'axios';
import { Device_Status } from '@prisma/client';
import { formatDateTime } from '@/lib/utils';

export interface PosDevice {
  id: string;
  serial_number: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  created_at: string;
}

export interface PosDeviceSession {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceSerial: string;
  userId: string;
  username: string;
  userRole: string;
  posFloat: number;
  assignedAt: string;
  unassignedAt: string | null;
  assignedBy: string;
  unassignedBy: string | null;
  unassignedReason: string | null;
  status: 'ACTIVE' | 'RETURNED';
}

export interface AvailableUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export interface LocationAssignment {
  id: string;
  locationName: string;
  locationAddress: string;
  assignedFor: string;
}

interface PosDevicesPageProps {
  role: 'ADMIN' | 'SUPERVISOR' | 'TICKETER';
  devices?: PosDevice[];
  sessions: PosDeviceSession[];
  availableUsers?: AvailableUser[];
  locations?: LocationAssignment[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  loggedInUserId?: string;
}

export default function PosDevicesPage({
  role,
  devices = [],
  sessions = [],
  availableUsers = [],
  locations = [],
  isLoading,
  onRefresh,
  loggedInUserId
}: PosDevicesPageProps) {
  const [q, setQ] = useState('');
  
  // Filtering variables
  const [actionFilter, setActionFilter] = useState<'ALL' | 'ACTIVE' | 'RETURNED'>('ALL');
  const [activeActionFilter, setActiveActionFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ALL');

  // Drawers State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<PosDevice | null>(null);
  const [selectedSession, setSelectedSession] = useState<PosDeviceSession | null>(null);

  // Form Fields
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceSerial, setNewDeviceSerial] = useState('');
  const [newDeviceStatus, setNewDeviceStatus] = useState<Device_Status>('INACTIVE');
  const [assignUserId, setAssignUserId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [topupAmount, setTopupAmount] = useState('');

  // Filter Rows
  const filteredEvents = useMemo(() => {
    return sessions.filter((e) => (actionFilter === 'ALL' ? true : e.status === actionFilter));
  }, [sessions, actionFilter]);

  const filteredDevices = useMemo(() => {
    return devices.filter((e) => (activeActionFilter === 'ALL' ? true : e.status === activeActionFilter));
  }, [devices, activeActionFilter]);

  const activeAssignedSession = useMemo(() => {
    return sessions.find(s => s.userId === loggedInUserId && s.status === 'ACTIVE');
  }, [sessions, loggedInUserId]);

  // Actions trigger handlers
  const handleOpenAssign = (device: PosDevice) => {
    setSelectedDevice(device);
    setAssignUserId(availableUsers[0]?.id || '');
    setIsAssignOpen(true);
  };

  const handleOpenReturn = (device: PosDevice) => {
    setSelectedDevice(device);
    setReturnReason('');
    setIsReturnOpen(true);
  };

  const handleOpenTopup = (sessionItem: PosDeviceSession) => {
    setSelectedSession(sessionItem);
    setTopupAmount('');
    setIsTopupOpen(true);
  };

  // API Call: Register POS Device
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName || !newDeviceSerial) {
      toast.error("All fields are required");
      return;
    }

    try {
      const res = await api.post('/admin/device', {
        name: newDeviceName,
        serial_number: newDeviceSerial,
        status: newDeviceStatus,
      });

      if (res.data.success) {
        toast.success("POS Device added successfully");
        setNewDeviceName('');
        setNewDeviceSerial('');
        setIsAddOpen(false);
        await onRefresh();
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err?.response?.data?.error || "Failed to add device");
      } else {
        toast.error("Failed to add device");
      }
    }
  };

  // API Call: Assign Device
 const handleAssignDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !assignUserId) {
      toast.error("Please select a user");
      return;
    }
    try {
      const endpoint = role === 'SUPERVISOR' ? '/supervisor/device/assign' : '/admin/device/assign';
      const res = await api.post(endpoint, {
        deviceId: selectedDevice.id,
        userId: assignUserId,
      });
      if (res.data.success) {
        toast.success(res.data.message || "Device assigned successfully");
        setIsAssignOpen(false);
        setSelectedDevice(null);
        await onRefresh();
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err?.response?.data?.error || "Failed to assign device");
      } else {
        toast.error("Failed to assign device");
      }
    }
  };

  // API Call: Return/Unassign Device
const handleReturnDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const activeSession = sessions.find(s => s.deviceId === selectedDevice.id && s.status === 'ACTIVE');
    if (!activeSession) {
      toast.error("Active session not found for this device");
      return;
    }
    try {
      const endpoint = role === 'SUPERVISOR' ? '/supervisor/device/assign' : '/admin/device/assign';
      const res = await api.put(endpoint, {
        sessionId: activeSession.id,
        reason: returnReason,
      });
      if (res.data.success) {
        toast.success(res.data.message || "Device returned successfully");
        setIsReturnOpen(false);
        setSelectedDevice(null);
        await onRefresh();
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err?.response?.data?.error || "Failed to release device");
      } else {
        toast.error("Failed to release device");
      }
    }
  };

  // API Call: Topup POS
  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !topupAmount || Number(topupAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const res = await api.post('/supervisor/topup', {
        posSessionId: selectedSession.id,
        amount: Number(topupAmount),
      });

      if (res.data.success) {
        toast.success(res.data.message || "POS topped up successfully");
        setIsTopupOpen(false);
        setSelectedSession(null);
        await onRefresh();
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err?.response?.data?.error || "Failed to topup POS");
      } else {
        toast.error("Failed to topup POS");
      }
    }
  };

  // Column definitions for Device Events (Audit Trails)
  const columns: ColumnDef<PosDeviceSession>[] = [
    { 
      id: 'device', 
      header: 'device', 
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-slate-300 text-xs font-bold">{r?.deviceName}</span>
          <span className="text-slate-500 text-[10px]">{r?.deviceSerial}</span>
        </div>
      ) 
    },
    { 
      id: 'ticketer', 
      header: 'ticketer', 
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-slate-400 text-xs">{r?.username}</span>
          <span className="text-slate-500 text-[10px] uppercase">{r?.userRole}</span>
        </div>
      ) 
    },
    { 
      id: 'posFloat', 
      header: 'current float', 
      cell: (r) => <span className="text-emerald-400 text-xs font-mono font-bold">₦{r?.posFloat?.toLocaleString()}</span> 
    },
    { 
      id: 'action', 
      header: 'action', 
      align: 'center', 
      sortValue: (r) => r?.status, 
      cell: (r) => <Badge variant={r?.status === 'ACTIVE' ? 'success' : 'warning'}>{r?.status}</Badge> 
    },
    { 
      id: 'reason', 
      header: 'reason', 
      cell: (r) => <span className="text-slate-500 text-xs">{r?.status === 'ACTIVE' ? `Active Assignment` : r?.unassignedReason || 'Returned'}</span> 
    },
    { 
      id: 'date', 
      header: 'date', 
      cell: (r) => (
        <span className="text-slate-500 text-xs">
          {r?.status === 'ACTIVE' 
            ? (r?.assignedAt ? formatDateTime(r.assignedAt) : '—') 
            : (r?.unassignedAt ? formatDateTime(r.unassignedAt) : '—')
          }
        </span>
      ) 
    },
    { 
      id: 'supervisor', 
      header: 'supervisor', 
      cell: (r) => (
        <span className="text-slate-400 text-xs">
          {r?.status === 'ACTIVE' ? r?.assignedBy : (r?.unassignedBy || '—')}
        </span>
      ) 
    },
    {
      id: 'topup',
      header: 'topup',
      align: 'right',
      cell: (r) => (
        r?.status === 'ACTIVE' && (role === 'SUPERVISOR' || role === 'ADMIN') ? (
          <button
            onClick={() => handleOpenTopup(r)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-3 h-3" /> Topup
          </button>
        ) : null
      )
    }
  ];

  // Column definitions for Active Devices (Inventory)
  const activeDevicesColumns: ColumnDef<PosDevice>[] = [
    { id: 'id', header: 'device id', cell: (r) => <span className="text-slate-300 text-xs font-bold font-mono">{r?.id}</span> },
    { id: 'name', header: 'name', cell: (r) => <span className="text-slate-400 text-xs">{r?.name}</span> },
    { 
      id: 'status', 
      header: 'status', 
      align: 'center', 
      sortValue: (r) => r?.status, 
      cell: (r) => (
        <Badge variant={r?.status === 'ACTIVE' ? 'success' : r?.status === 'INACTIVE' ? 'neutral' : 'danger'}>
          {r?.status}
        </Badge>
      ) 
    },
    { id: 'serial_number', header: 'serial_number', cell: (r) => <span className="text-slate-500 text-xs">{r?.serial_number}</span> },
    { 
      id: 'created_at', 
      header: 'created_at', 
      cell: (r) => <span className="text-slate-500 text-xs">{r?.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</span> 
    },
     {
      id: 'actions',
      header: 'actions',
      align: 'right',
      cell: (r) => (
        role === 'ADMIN' || role === 'SUPERVISOR' ? (
          <div className="flex gap-2 justify-end">
            {r?.status === 'INACTIVE' && (
              <button
                onClick={() => handleOpenAssign(r)}
                className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
              >
                Assign
              </button>
            )}
            {r?.status === 'ACTIVE' && (
              // If supervisor, only show "Return" if the device is active for one of their ticketers.
              // Otherwise, show "Assigned (Other)" to prevent illegal returns.
              (role !== 'SUPERVISOR' || sessions.some(s => s.deviceId === r.id && s.status === 'ACTIVE')) ? (
                <button
                  onClick={() => handleOpenReturn(r)}
                  className="px-3 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors cursor-pointer"
                >
                  Return
                </button>
              ) : (
                <span className="text-slate-500 text-xs italic">Assigned (Other)</span>
              )
            )}
            {r?.status === 'MAINTENANCE' && (
              <span className="text-slate-500 text-xs italic">Maintenance</span>
            )}
          </div>
        ) : (
          <span className="text-slate-500 text-xs italic">View Only</span>
        )
      )
    }


  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 text-sm font-medium">Loading POS terminals data...</div>
      </div>
    );
  }

  // --- RENDERING FOR TICKETER (USER) ---
  if (role === 'TICKETER') {
    return (
      <PageScaffold
        title="My POS Terminal"
        subtitle="View your active POS details and assignment history"
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard 
              title="Active Terminal" 
              value={activeAssignedSession ? activeAssignedSession.deviceName : 'None Assigned'} 
              icon={<Smartphone className="text-blue-300" />} 
              iconBg="bg-blue-500/10" 
            />
            <StatCard 
              title="Current Float" 
              value={activeAssignedSession ? `₦${activeAssignedSession.posFloat.toLocaleString()}` : '₦0'} 
              icon={<Smartphone className="text-emerald-300" />} 
              iconBg="bg-emerald-500/10" 
            />
            <StatCard 
              title="Devices Used" 
              value={String(sessions.length)} 
              icon={<Smartphone className="text-slate-300" />} 
              iconBg="bg-slate-500/10" 
            />
            <StatCard 
              title="Active Location" 
              value={locations[0] ? locations[0].locationName : 'No assigned location'} 
              icon={<Smartphone className="text-purple-300" />} 
              iconBg="bg-purple-500/10" 
            />
          </div>
        }
      >
        <div className="space-y-8">
          {/* Active Terminal Info */}
          {activeAssignedSession ? (
            <div className="glass-panel border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-white text-base font-bold tracking-tight">Active Assignment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="space-y-1">
                  <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">Terminal Name</p>
                  <p className="text-slate-200 font-bold">{activeAssignedSession.deviceName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">Serial Number</p>
                  <p className="text-slate-200 font-mono font-bold">{activeAssignedSession.deviceSerial}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">Assigned At</p>
                  <p className="text-slate-200 font-bold">{new Date(activeAssignedSession.assignedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 border border-amber-500/20 bg-amber-500/5 rounded-3xl text-center">
              <p className="text-sm text-amber-300 font-semibold">You do not have any active POS terminal assigned to you at this time.</p>
              <p className="text-xs text-slate-500 mt-1">Please contact your administrator or supervisor to assign a device.</p>
            </div>
          )}

          {/* Assigned Locations */}
          <div className="space-y-3">
            <h3 className="text-slate-300 text-xs font-bold uppercase tracking-wider">My Assigned Locations</h3>
            <DataTable
              rows={locations}
              columns={[
                { id: 'name', header: 'location name', cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.locationName}</span> },
                { id: 'address', header: 'address', cell: (r) => <span className="text-slate-500 text-xs">{r?.locationAddress}</span> },
                { id: 'date', header: 'assigned date', cell: (r) => <span className="text-slate-400 text-xs">{r?.assignedFor}</span> },
              ]}
              getRowId={(r) => r.id}
            />
          </div>

          {/* User's Session History */}
          <div className="space-y-3">
            <h3 className="text-slate-300 text-xs font-bold uppercase tracking-wider">My Terminal History</h3>
            <DataTable
              rows={filteredEvents}
              columns={columns.filter(col => col.id !== 'ticketer' && col.id !== 'topup')}
              getRowId={(r) => r.id}
              searchValue={q}
              searchPredicate={(r, qq) =>
                r.deviceName.toLowerCase().includes(qq) ||
                r.deviceSerial.toLowerCase().includes(qq) ||
                r.status.toLowerCase().includes(qq)
              }
            />
          </div>
        </div>
      </PageScaffold>
    );
  }

  // --- RENDERING FOR ADMIN & SUPERVISOR ---
  return (
    <>
      <PageScaffold
        title={role === 'ADMIN' ? "POS Device Management" : "POS Devices Overview"}
        subtitle={role === 'ADMIN' ? "Register, assign, and track POS devices" : "View terminal sessions and topup POS"}
        right={
          <div className="flex items-center gap-3">
            {role === 'ADMIN' && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors cursor-pointer font-semibold"
              >
                <Plus className="w-4 h-4" /> Add Device
              </button>
            )}
            <Select
              value={actionFilter}
              onChange={(v) => setActionFilter(v)}
              options={[
                { value: 'ALL', label: 'All events' },
                { value: 'ACTIVE', label: 'Assigned Only' },
                { value: 'RETURNED', label: 'Returned Only' },
              ]}
            />
          </div>
        }
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Total Pos" value={String(devices.length)} icon={<Smartphone className="text-blue-300" />} iconBg="bg-blue-500/10" />
            <StatCard title="Assigned Sessions" value={String(devices.filter((r) => r.status === 'ACTIVE').length)} icon={<Smartphone className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
            <StatCard title="Inactive" value={String(devices.filter((r) => r.status === 'INACTIVE').length)} icon={<Smartphone className="text-slate-300" />} iconBg="bg-slate-500/10" />
            <StatCard title="In Maintenance" value={String(devices.filter((r) => r.status === 'MAINTENANCE').length)} icon={<Smartphone className="text-red-300" />} iconBg="bg-red-500/10" />
          </div>
        }
      >
        <FilterRow>
          <Input value={q} onChange={setQ} placeholder="Search device/ticketer/actor…" />
          <div className="text-slate-500 text-xs font-medium">Every switch is tracked on the ledger (actor + reason).</div>
        </FilterRow>

        <div className="space-y-8">
          <div className="space-y-3">
            <h3 className="text-slate-300 text-xs font-bold uppercase tracking-wider">Active POS Inventory</h3>  
            <DataTable
              rows={filteredDevices}
              columns={activeDevicesColumns}
              getRowId={(r) => r.id}
              searchValue={q}
              searchPredicate={(r, qq) =>
                r.id.toLowerCase().includes(qq) ||
                r.name.toLowerCase().includes(qq) ||
                r.serial_number.toLowerCase().includes(qq) ||
                r.status.toLowerCase().includes(qq)
              }
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-slate-300 text-xs font-bold uppercase tracking-wider">Device Session History</h3> 
            <DataTable
              rows={filteredEvents}
              columns={columns}
              getRowId={(r) => r.id}
              searchValue={q}
              searchPredicate={(r, qq) =>
                r.id.toLowerCase().includes(qq) ||
                r.username.toLowerCase().includes(qq) ||
                r.assignedBy.toLowerCase().includes(qq) ||
                r.status.toLowerCase().includes(qq)
              }
            />
          </div>
        </div>
      </PageScaffold>

      {/* DRAWER 1: Add POS Device */}
      <Drawer
        open={isAddOpen}
        title="Add New POS Device"
        subtitle="Register a new POS terminal into the system inventory."
        onClose={() => setIsAddOpen(false)}
      >
        <form onSubmit={handleAddDevice} className="space-y-5 mt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Device Name</label>
            <input
              type="text"
              required
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              placeholder="e.g. Oluwa, Diya, Tunde"
              className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Serial Number</label>
            <input
              type="text"
              required
              value={newDeviceSerial}
              onChange={(e) => setNewDeviceSerial(e.target.value)}
              placeholder="e.g. POS-AX12"
              className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Initial Status</label>
            <select
              value={newDeviceStatus}
              onChange={(e) => setNewDeviceStatus(e.target.value as Device_Status)}
              className="w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
            >
              <option value="INACTIVE">Inactive / Available</option>
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="w-full rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 py-3 transition-all cursor-pointer text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 transition-all cursor-pointer text-sm"
            >
              Add Device
            </button>
          </div>
        </form>
      </Drawer>

      {/* DRAWER 2: Assign POS Device */}
      <Drawer
        open={isAssignOpen}
        title={selectedDevice ? `Assign POS: ${selectedDevice.name}` : "Assign POS Device"}
        subtitle="Assign this terminal to a ticketer or supervisor to start their session."
        onClose={() => {
          setIsAssignOpen(false);
          setSelectedDevice(null);
        }}
      >
        {selectedDevice && (
          <form onSubmit={handleAssignDevice} className="space-y-5 mt-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Terminal Name:</span>
                <span className="text-slate-200 font-bold">{selectedDevice.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Serial Number:</span>
                <span className="text-slate-200 font-bold font-mono">{selectedDevice.serial_number}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Staff (User)</label>
              {availableUsers.length === 0 ? (
                <div className="p-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  No staff members are currently available (unassigned).
                </div>
              ) : (
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="w-full rounded-xl bg-gray-900 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
                >
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {`${u.first_name} ${u.last_name} (${u.role})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3.5">
              <p className="text-xs text-blue-200 leading-relaxed">
                <strong>Handover Protocol:</strong> The device&apos;s previous closing float balance (if any) will automatically be inherited by the new user as their starting opening float balance.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsAssignOpen(false);
                  setSelectedDevice(null);
                }}
                className="w-full rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 py-3 transition-all cursor-pointer text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={availableUsers.length === 0}
                className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 transition-all cursor-pointer disabled:bg-slate-800 disabled:text-slate-600 text-sm"
              >
                Confirm Assignment
              </button>
            </div>
          </form>
        )}
      </Drawer>

      {/* DRAWER 3: Return / Release POS Device */}
      <Drawer
        open={isReturnOpen}
        title={selectedDevice ? `Return POS: ${selectedDevice.name}` : "Return POS Device"}
        subtitle="Unassign the terminal and return it to active inventory."
        onClose={() => {
          setIsReturnOpen(false);
          setSelectedDevice(null);
        }}
      >
        {selectedDevice && (
          <form onSubmit={handleReturnDevice} className="space-y-5 mt-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Terminal Name:</span>
                <span className="text-slate-200 font-bold">{selectedDevice.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Serial Number:</span>
                <span className="text-slate-200 font-bold font-mono">{selectedDevice.serial_number}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Return Reason / Note</label>
              <textarea
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. End of shift, Battery issues, Touchscreen unresponsive..."
                rows={4}
                className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 resize-none"
              />
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5">
              <p className="text-xs text-amber-200 leading-relaxed">
                The terminal&apos;s final float balance will be locked into this session&apos;s history and carried over to the next user upon assignment.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsReturnOpen(false);
                  setSelectedDevice(null);
                }}
                className="w-full rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 py-3 transition-all cursor-pointer text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 transition-all cursor-pointer text-sm"
              >
                Confirm Return
              </button>
            </div>
          </form>
        )}
      </Drawer>

      {/* DRAWER 4: Topup POS Session (Supervisor & Admin) */}
      <Drawer
        open={isTopupOpen}
        title={selectedSession ? `Topup POS Session: ${selectedSession.deviceName}` : "Topup POS Session"}
        subtitle="Add topup float to this active session."
        onClose={() => {
          setIsTopupOpen(false);
          setSelectedSession(null);
        }}
      >
        {selectedSession && (
          <form onSubmit={handleTopupSubmit} className="space-y-5 mt-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Assigned Ticketer:</span>
                <span className="text-slate-200 font-bold">{selectedSession.username}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Current POS Float:</span>
                <span className="text-emerald-400 font-bold">₦{selectedSession.posFloat.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Topup Amount (₦)</label>
              <input
                type="number"
                required
                min="1"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsTopupOpen(false);
                  setSelectedSession(null);
                }}
                className="w-full rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 py-3 transition-all cursor-pointer text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 transition-all cursor-pointer text-sm"
              >
                Submit Topup
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </>
  );
}
