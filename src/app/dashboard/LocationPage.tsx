'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Calendar, Plus, Search, Trash2, UserCheck, AlertTriangle } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { PageScaffold } from '@/components/pageScaffold';
import { toast } from 'react-toastify';
import { useDashboard } from '@/app/dashboard/layout';
import { Ticketer_Location_Assignment, User } from '../types/types';

interface Location {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

interface LocationAssignment {
  id: string;
  assignmentId: string;
  locationName: string;
  locationAddress: string;
  assignedFor: string;
  userId?: string;
  ticketerName?: string;
  ticketerEmail?: string;
}

interface UserListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

type TabType = 'ASSIGNMENTS' | 'LOCATIONS';

export default function LocationsPage({ role = 'TICKETER' }: { role?: string }) {
  const userRole = (role?.toUpperCase() || 'TICKETER') as 'TICKETER' | 'SUPERVISOR' | 'ADMIN';

  // Tabs
  const [activeTab, setActiveTab] = useState<TabType>(userRole === 'TICKETER' ? 'ASSIGNMENTS' : 'ASSIGNMENTS');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [assignmentDateLabel, setAssignmentDateLabel] = useState('');

  // Data states
  const [locations, setLocations] = useState<Location[]>([]);
  const [assignments, setAssignments] = useState<LocationAssignment[]>([]);
  const [ticketers, setTicketers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Drawers
  const [openLocationDrawer, setOpenLocationDrawer] = useState(false);
  const [openAssignmentDrawer, setOpenAssignmentDrawer] = useState(false);

  // Location Form
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');

  // Assignment Form
  const [assignMode, setAssignMode] = useState<'single' | 'range'>('single');
  const [selectedTicketer, setSelectedTicketer] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Fetch Locations
  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      if (data.success) {
        setLocations(data.data);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load locations list');
    }
  }, []);

  // Fetch Assignments (Roster)
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const query = filterDate ? `?date=${filterDate}` : '';
      const res = await fetch(`/api/locations/assignments${query}`);
      const data = await res.json();
      if (data.success) {
        setAssignments(data.data);
        if (data.date) {
          setAssignmentDateLabel(data.date);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  // Fetch Ticketers
  const fetchTicketers = useCallback(async () => {
    try {
      // Supervisor fetches their team, Admin fetches all ticketers
      const url = userRole === 'SUPERVISOR' ? '/api/supervisor/user' : '/api/admin/user?role=TICKETER';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        // Admin response mapping differs slightly from Supervisor endpoint
        const list = userRole === 'SUPERVISOR' 
          ? data.data 
          : data.data.map((u: User) => ({
              id: u.user_id,
              first_name: u?.username?.split(' ')[0] || '',
              last_name: u?.username?.split(' ')[1] || '',
              email: u?.email
            }));
        setTicketers(list);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to fetch ticketers list');
    }
  }, [userRole]);

  // Initial Data Load
  useEffect(() => {
    async function loadAll() {
      await fetchLocations();
      await fetchAssignments();
      if (userRole === 'SUPERVISOR') {
        await fetchTicketers();
      }
    }
    loadAll();
  }, [fetchLocations, fetchAssignments, fetchTicketers, userRole]);

  // Create Location (Admin Only)
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName || !newLocAddress) {
      return toast.error('Please input a location name and address');
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLocName, address: newLocAddress }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Location created successfully');
        setNewLocName('');
        setNewLocAddress('');
        setOpenLocationDrawer(false);
        fetchLocations();
      } else {
        toast.error(data.error || 'Failed to create location');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error creating location');
    } finally {
      setSubmitting(false);
    }
  };

  // Assign Location (Supervisor Only)
  const handleAssignLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketer || !selectedLocation) {
      return toast.error('Please select both a ticketer and a location');
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/locations/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: assignMode,
          userId: selectedTicketer,
          locationId: selectedLocation,
          date: assignDate,
          startDate: assignStartDate,
          endDate: assignEndDate,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Assignments created successfully');
        setSelectedTicketer('');
        setSelectedLocation('');
        setAssignDate('');
        setAssignStartDate('');
        setAssignEndDate('');
        setOpenAssignmentDrawer(false);
        fetchAssignments();
      } else {
        toast.error(data.error || 'Failed to save assignments');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error creating assignments');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Assignment (Supervisor Only)
  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    try {
      const res = await fetch(`/api/locations/assignments?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Assignment deleted successfully');
        fetchAssignments();
      } else {
        toast.error(data.error || 'Failed to delete assignment');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error deleting assignment');
    }
  };

  // --- DATATABLE COLUMNS CONFIG ---

   const assignmentColumns: ColumnDef<LocationAssignment>[] = [
    {
      id: 'date',
      header: 'Assigned Date',
      cell: (row) => <span className="font-semibold text-white">{row?.assignedFor}</span>,
      sortValue: (row) => row.assignedFor,
    },
    {
      id: 'location',
      header: 'Location Name',
      cell: (row) => <span className="font-semibold text-slate-300">{row?.locationName}</span>,
      sortValue: (row) => row.locationName,
    },
    {
      id: 'address',
      header: 'Address',
      cell: (row) => <span className="text-slate-400">{row?.locationAddress}</span>,
    },
    ...(userRole !== 'TICKETER'
      ? [
          {
            id: 'ticketer',
            header: 'Assigned Ticketer',
            cell: (row?: LocationAssignment) => (
              <div>
                <p className="font-bold text-white">{row?.ticketerName || 'Unassigned'}</p>
                <p className="text-[10px] text-slate-500">{row?.ticketerEmail}</p>
              </div>
            ),
            sortValue: (row: LocationAssignment) => row.ticketerName || '',
          },
        ]
      : []),
    ...(userRole === 'SUPERVISOR'
      ? [
          {
            id: 'actions',
            header: 'Actions',
            cell: (row?: LocationAssignment) => (
              <button
                onClick={() => handleDeleteAssignment(row?.assignmentId || '')}
                className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all"
              >
                <Trash2 className="size-4" />
              </button>
            ),
          },
        ]
      : []),
  ];


  const locationColumns: ColumnDef<Location>[] = [
    {
      id: 'name',
      header: 'Location Name',
      cell: (row) => <span className="font-bold text-white">{row?.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: 'address',
      header: 'Physical Address',
      cell: (row) => <span className="text-slate-300">{row?.address}</span>,
    },
  ];

  return (
    <>
      <PageScaffold
        title="Locations"
        subtitle={
          userRole === 'TICKETER'
            ? 'View your personal schedule and daily assigned routes'
            : 'Manage terminal locations and ticketer daily schedules'
        }
        right={
          <div className="flex flex-wrap items-center gap-3">
            {/* Tab switchers */}
            <div className="inline-flex rounded-full border border-white/10 bg-white/3 p-1 shadow-sm">
              <button
                onClick={() => setActiveTab('ASSIGNMENTS')}
                className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === 'ASSIGNMENTS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                Assignments / Roster
              </button>
              <button
                onClick={() => setActiveTab('LOCATIONS')}
                className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === 'LOCATIONS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                Registered Locations
              </button>
            </div>

            {/* Action buttons */}
            {userRole === 'ADMIN' && activeTab === 'LOCATIONS' && (
              <button
                onClick={() => setOpenLocationDrawer(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Location
              </button>
            )}

            {userRole === 'SUPERVISOR' && activeTab === 'ASSIGNMENTS' && (
              <button
                onClick={() => setOpenAssignmentDrawer(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20 transition-all"
              >
                <UserCheck className="w-4 h-4" /> Assign Location
              </button>
            )}
          </div>
        }
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Registered Locations"
              value={locations.length.toString()}
              icon={<MapPin className="text-sky-400" />}
              iconBg="bg-sky-500/10"
            />
            <StatCard
              title={userRole === 'TICKETER' ? 'My Assignments' : `Roster Count`}
              value={assignments.length.toString()}
              icon={<Calendar className="text-emerald-400" />}
              iconBg="bg-emerald-500/10"
            />
          </div>
        }
      >
        {/* Main Filters Row */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full max-w-md bg-white/3 border border-white/10 rounded-xl px-4 py-2.5">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={
                  activeTab === 'ASSIGNMENTS' ? 'Search assignments...' : 'Search location name or address...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-slate-600"
              />
            </div>

            {activeTab === 'ASSIGNMENTS' && userRole !== 'TICKETER' && (
              <div className="flex items-center gap-3">
                <label className="text-slate-400 text-xs font-semibold">Filter Date:</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="rounded-xl bg-white/3 border border-white/10 px-4 py-2 text-sm text-white focus:outline-none"
                />
                {filterDate && (
                  <button
                    onClick={() => setFilterDate('')}
                    className="text-xs text-rose-400 underline font-semibold cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-6">
            {activeTab === 'ASSIGNMENTS' ? (
              <div>
                {userRole !== 'TICKETER' && (
                  <p className="text-slate-500 text-xs mb-3 italic">
                    Showing rosters for: <strong className="text-slate-300">{assignmentDateLabel || 'Latest Schedule'}</strong>
                  </p>
                )}
                <DataTable
                  rows={assignments}
                  columns={assignmentColumns}
                  getRowId={(row) => row.assignmentId}
                  searchValue={searchQuery}
                  searchPredicate={(row, q) =>
                    row.locationName.toLowerCase().includes(q) ||
                    row.locationAddress.toLowerCase().includes(q) ||
                    (row.ticketerName || '').toLowerCase().includes(q)
                  }
                  emptyLabel="No assignments scheduled for this date query."
                />
              </div>
            ) : (
              <DataTable
                rows={locations}
                columns={locationColumns}
                getRowId={(row) => row.id}
                searchValue={searchQuery}
                searchPredicate={(row, q) =>
                  row.name.toLowerCase().includes(q) || row.address.toLowerCase().includes(q)
                }
                emptyLabel="No physical terminals registered."
              />
            )}
          </div>
        </div>
      </PageScaffold>

      {/* ADMIN: Add Location Drawer */}
      <Drawer
        open={openLocationDrawer}
        title="Add Terminal Location"
        subtitle="Register a new route or location to the system"
        onClose={() => setOpenLocationDrawer(false)}
      >
        <form onSubmit={handleCreateLocation} className="space-y-4">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Location Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Iyana Ipaja Bus-Stop"
              value={newLocName}
              onChange={(e) => setNewLocName(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Physical Address</label>
            <input
              type="text"
              required
              placeholder="e.g. 45 Abeokuta Expressway, Lagos"
              value={newLocAddress}
              onChange={(e) => setNewLocAddress(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-linear-to-r from-emerald-400 to-teal-400 text-black py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'Registering...' : 'Add Location'}
          </button>
        </form>
      </Drawer>

      {/* SUPERVISOR: Assign Location Drawer */}
      <Drawer
        open={openAssignmentDrawer}
        title="Schedule Daily / Roster Mapping"
        subtitle="Assign a ticketer to a specific station roster"
        onClose={() => setOpenAssignmentDrawer(false)}
      >
        <form onSubmit={handleAssignLocation} className="space-y-4">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Scheduling Mode</label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setAssignMode('single')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all ${
                  assignMode === 'single' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-transparent border-white/10 text-slate-400'
                }`}
              >
                Single Day
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('range')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all ${
                  assignMode === 'range' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-transparent border-white/10 text-slate-400'
                }`}
              >
                Roster Date Range (Full Month)
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Select Ticketer</label>
            <select
              required
              value={selectedTicketer}
              onChange={(e) => setSelectedTicketer(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            >
              <option value="" className="bg-black">Select ticketer...</option>
              {ticketers.map((t) => (
                <option key={t.id} value={t.id} className="bg-black">
                  {t.first_name} {t.last_name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Select Station / Location</label>
            <select
              required
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            >
              <option value="" className="bg-black">Select location...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id} className="bg-black">
                  {l.name} - {l.address}
                </option>
              ))}
            </select>
          </div>

          {assignMode === 'single' ? (
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Date</label>
              <input
                type="date"
                required
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Start Date</label>
                <input
                  type="date"
                  required
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">End Date</label>
                <input
                  type="date"
                  required
                  value={assignEndDate}
                  onChange={(e) => setAssignEndDate(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {assignMode === 'range' && (
            <div className="flex gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-[11px] text-indigo-300">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Bulk assigning will automatically override any existing overlapping assignments for this ticketer/station in the selected window.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-linear-to-r from-indigo-400 to-violet-400 text-black py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'Scheduling...' : 'Save Assignments'}
          </button>
        </form>
      </Drawer>
    </>
  );
}
