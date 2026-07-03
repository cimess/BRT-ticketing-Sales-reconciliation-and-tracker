'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Calendar, Plus, Search, Trash2, UserCheck, AlertTriangle, Edit } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { PageScaffold } from '@/components/pageScaffold';
import { toast } from 'react-toastify';
import { User } from '../types/types';
import api from '../lib/axios';
import axios from 'axios';

interface Location {
  id: string;
  name: string;
  address: string;
  created_at: string;
  opening_time?: string | null;
  closing_time?: string | null;
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

interface MonthlyStat {
  locationId: string;
  locationName: string;
  userId: string;
  userName: string;
  visitCount: number;
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

    const [newLocOpeningTime, setNewLocOpeningTime] = useState('');
  const [newLocClosingTime, setNewLocClosingTime] = useState('');


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
  const [bulkAssignments, setBulkAssignments] = useState<Record<string, string>>({});

  // Edit Assignment Form States
  const [selectedEditAssignment, setSelectedEditAssignment] = useState<LocationAssignment | null>(null);
  const [editTicketer, setEditTicketer] = useState('');
  const [editLocation, setEditLocation] = useState('');

    // Edit Location States
  const [selectedEditLocation, setSelectedEditLocation] = useState<Location | null>(null);
  const [openEditLocationDrawer, setOpenEditLocationDrawer] = useState(false);
  const [editLocName, setEditLocName] = useState('');
  const [editLocAddress, setEditLocAddress] = useState('');
  const [editLocOpeningTime, setEditLocOpeningTime] = useState('');
  const [editLocClosingTime, setEditLocClosingTime] = useState('');


  // Query Filters state
  const [scope, setScope] = useState<'personal' | 'team'>(userRole === 'TICKETER' ? 'personal' : 'team');
  const [selectedFilterUserId, setSelectedFilterUserId] = useState<string>('');
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  // Monthly stats & Bulk mapping layout
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // 1. Fetch monthly stats when date changes in the assignment drawer
  // 1. Fetch monthly stats when date changes in the assignment drawer
  useEffect(() => {
    if (!assignDate) return;
    const yearMonth = assignDate.substring(0, 7); // "YYYY-MM"

    const fetchMonthlyStats = async () => {
      setLoadingStats(true);
      try {
        const res = await api.get(`/locations/assignments?statsMonth=${yearMonth}`);
        if (res.data?.success) {
          setMonthlyStats(res.data.monthlyStats || []);
        }
      } catch (err) {
        console.error("Error loading monthly stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchMonthlyStats();
  }, [assignDate]);

  

  const getVisitCount = (userId: string, locationId: string) => {
    const stat = monthlyStats.find(
      (s) => s.userId === userId && s.locationId === locationId
    );
    return stat ? stat.visitCount : 0;
  };

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
      const params = new URLSearchParams();
      if (dateMode === 'single') {
        if (filterDate) params.append('date', filterDate);
      } else {
        if (filterStartDate) params.append('startDate', filterStartDate);
        if (filterEndDate) params.append('endDate', filterEndDate);
      }
      params.append('scope', scope);
      if (selectedFilterUserId) {
        params.append('userId', selectedFilterUserId);
      }

      const res = await fetch(`/api/locations/assignments?${params.toString()}`);
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
  }, [filterDate, filterStartDate, filterEndDate, dateMode, scope, selectedFilterUserId]);

  // Trigger fetch when query params change
  // Trigger fetch when query params change
  useEffect(() => {
    let active = true;
    const load = async () => {
      // Defer to microtask to prevent synchronous setState warning in React
      await Promise.resolve();
      if (active) {
        fetchAssignments();
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [fetchAssignments]);


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
            const res = await api.post('/locations', {
        name: newLocName,
        address: newLocAddress,
        opening_time: newLocOpeningTime || null,
        closing_time: newLocClosingTime || null,
      });

      if (res.status === 200) {
        toast.success('Location created successfully');
        setNewLocName('');
        setNewLocAddress('');
        setOpenLocationDrawer(false);
        fetchLocations();
      } else {
        toast.error(res?.data?.message || 'Failed to create location');
      }
    } catch (err) {
      console.error(err);
      if (err instanceof axios.AxiosError) {
        toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Network error creating location');
      }
      else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };

    // Edit Location (Admin Only)
  const handleEditLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditLocation || !editLocName || !editLocAddress) {
      return toast.error('Please input a location name and address');
    }
    setSubmitting(true);
    try {
      const res = await api.patch('/locations', {
        id: selectedEditLocation.id,
        name: editLocName,
        address: editLocAddress,
        opening_time: editLocOpeningTime || null,
        closing_time: editLocClosingTime || null,
      });

      if (res.status === 200 && res.data.success) {
        toast.success('Location updated successfully');
        setSelectedEditLocation(null);
        setOpenEditLocationDrawer(false);
        fetchLocations();
      } else {
        toast.error(res?.data?.message || 'Failed to update location');
      }
    } catch (err) {
      console.error(err);
      if (err instanceof axios.AxiosError) {
        toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Network error updating location');
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };


  // Reassign / Update Assignment (Supervisor Only)
  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditAssignment || !editTicketer || !editLocation) {
      return toast.error('Please select both a ticketer and a location');
    }
    setSubmitting(true);
    try {
      const res = await api.patch('/locations/assignments', {
        assignmentId: selectedEditAssignment.assignmentId,
        userId: editTicketer,
        locationId: editLocation,
      });
      if (res.status === 200 && res.data.success) {
        toast.success(res.data.message || 'Assignment updated successfully');
        setSelectedEditAssignment(null);
        setEditTicketer('');
        setEditLocation('');
        fetchAssignments();
      } else {
        toast.error(res?.data?.error || 'Failed to update assignment');
      }
    } catch (err) {
      console.error(err);
      if (err instanceof axios.AxiosError) {
        toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Network error updating assignment');
      }
      else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Smart Auto-Assign Roster (Supervisor Only)
  const handleAutoAssign = async () => {
    const targetDate = filterDate || assignmentDateLabel || new Date().toISOString().split('T')[0];
    if (!confirm(`Are you sure you want to run smart auto-assignment for ${targetDate}? This will assign available ticketers to open locations based on least recent visits.`)) return;

    setSubmitting(true);
    try {
      const res = await api.post('/locations/assignments', {
        mode: 'auto',
        date: targetDate,
      });
      if (res.status === 200 && res.data.success) {
        toast.success(res.data.message || 'Auto-assignment completed successfully');
        fetchAssignments();
      } else {
        toast.error(res?.data?.error || 'Failed to auto-assign');
      }
    } catch (err) {
      console.error(err);
      if (err instanceof axios.AxiosError) {
        toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Network error running auto-assignment');
      }
      else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };


  // Assign Location (Supervisor Only)
  const handleAssignLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignDate) {
      return toast.error('Please select an assignment date');
    }

    if (assignMode === 'single') {
      if (!selectedTicketer || !selectedLocation) {
        return toast.error('Please select both a ticketer and a location');
      }

      setSubmitting(true);
      try {
        const res = await api.post('/locations/assignments', {
          mode: 'bulk',
          date: assignDate,
          assignments: [
            {
              locationId: selectedLocation,
              userId: selectedTicketer,
            }
          ],
        });
        if (res.status === 200 && res.data.success) {
          toast.success(res.data.message || 'Roster saved successfully');
          // Reset form states
          setSelectedTicketer('');
          setSelectedLocation('');
          setAssignDate('');
          setOpenAssignmentDrawer(false);
          fetchAssignments();
        } else {
          toast.error(res?.data?.error || 'Failed to save assignments');
        }
      } catch (err) {
        console.error(err);
        if (err instanceof axios.AxiosError) {
          toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Network error saving roster');
        } else {
          toast.error('An unexpected error occurred');
        }
      } finally {
        setSubmitting(false);
      }

    } else {
      // Bulk/Roster Mode (Single date, multiple users)
      const activeAssignments = Object.entries(bulkAssignments)
        .filter(([_, locationId]) => locationId !== "")
        .map(([userId, locationId]) => ({
          userId,
          locationId,
        }));

      if (activeAssignments.length === 0) {
        return toast.error('Please assign at least one ticketer to a station');
      }

      setSubmitting(true);
      try {
        const res = await api.post('/locations/assignments', {
          mode: 'bulk',
          date: assignDate,
          assignments: activeAssignments,
        });

        if (res.status === 200 && res.data.success) {
          toast.success(res.data.message || 'Roster saved successfully');
          // Reset form states
          setBulkAssignments({});
          setAssignDate('');
          setOpenAssignmentDrawer(false);
          fetchAssignments();
        } else {
          toast.error(res?.data?.error || 'Failed to save roster');
        }
      } catch (err) {
        console.error(err);
        if (err instanceof axios.AxiosError) {
          toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Network error saving roster');
        } else {
          toast.error('An unexpected error occurred');
        }
      } finally {
        setSubmitting(false);
      }
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
       ...(userRole !== 'TICKETER' || scope === 'team'
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (row) {
                    setSelectedEditAssignment(row);
                    setEditTicketer(row.userId || '');
                    setEditLocation(row.id || '');
                  }
                }}
                className="p-2 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all"
                title="Reassign / Edit"
              >
                <Edit className="size-4" />
              </button>
              <button
                onClick={() => handleDeleteAssignment(row?.assignmentId || '')}
                className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all"
                title="Delete Assignment"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
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
    {
      id: 'opening_time',
      header: 'Opening Time',
      cell: (row) => <span className="text-slate-400">{row?.opening_time || 'N/A'}</span>,
    },
    {
      id: 'closing_time',
      header: 'Closing Time',
      cell: (row) => <span className="text-slate-400">{row?.closing_time || 'N/A'}</span>,
    },
    // Add this actions section here:
    ...(userRole === 'ADMIN'
      ? [
        {
          id: 'actions',
          header: 'Actions',
          cell: (row?: Location) => (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (row) {
                    setSelectedEditLocation(row);
                    setEditLocName(row.name);
                    setEditLocAddress(row.address);
                    setEditLocOpeningTime(row.opening_time || '');
                    setEditLocClosingTime(row.closing_time || '');
                    setOpenEditLocationDrawer(true);
                  }
                }}
                className="p-2 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all"
                title="Edit Location"
              >
                <Edit className="size-4" />
              </button>
            </div>
          ),
        },
      ]
      : []),
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
                className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'ASSIGNMENTS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'
                  }`}
              >
                Assignments / Roster
              </button>
              <button
                onClick={() => setActiveTab('LOCATIONS')}
                className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'LOCATIONS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'
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
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoAssign}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-all"
                >
                  <Calendar className="w-4 h-4" /> Auto Assign
                </button>
                               <button
                  onClick={() => {
                    // Reset all form states on open
                    setAssignDate('');
                    setSelectedTicketer('');
                    setSelectedLocation('');
                    setBulkAssignments({});
                    setAssignStartDate('');
                    setAssignEndDate('');
                    setOpenAssignmentDrawer(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20 transition-all"
                >
                  <UserCheck className="w-4 h-4" /> Assign Location
                </button>



              </div>
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
        <div className="rounded-2xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl space-y-4">
          
          {/* Scope Toggle & Search Bar */}
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

            {activeTab === 'ASSIGNMENTS' && userRole === 'TICKETER' && (
              <div className="flex items-center gap-3 self-start md:self-auto">
                <div className="inline-flex rounded-full border border-white/10 bg-white/3 p-1 shadow-sm">
                  <button
                    onClick={() => {
                      setScope('personal');
                      setSelectedFilterUserId('');
                    }}
                    className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      scope === 'personal' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'
                    }`}
                  >
                    My Roster
                  </button>
                  <button
                    onClick={() => setScope('team')}
                    className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      scope === 'team' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'
                    }`}
                  >
                    Team Roster
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Filters (Only show for assignments table) */}
          {activeTab === 'ASSIGNMENTS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/5">
              
              {/* Date Mode */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Date Mode</label>
                <select
                  value={dateMode}
                  onChange={(e) => {
                    setDateMode(e.target.value as 'single' | 'range');
                    setFilterDate('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                  }}
                  className="rounded-xl bg-white/3 border border-white/10 px-4 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="single" className="bg-black">Single Day</option>
                  <option value="range" className="bg-black">Date Range</option>
                </select>
              </div>

              {/* Conditional Date Pickers */}
              {dateMode === 'single' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Date</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="rounded-xl bg-white/3 border border-white/10 px-4 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Start Date</label>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="rounded-xl bg-white/3 border border-white/10 px-4 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">End Date</label>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="rounded-xl bg-white/3 border border-white/10 px-4 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Person Filter (Dropdown of all team members) */}
              {(scope === 'team' || userRole !== 'TICKETER') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Filter by Person</label>
                  <select
                    value={selectedFilterUserId}
                    onChange={(e) => setSelectedFilterUserId(e.target.value)}
                    className="rounded-xl bg-white/3 border border-white/10 px-4 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="" className="bg-black">All Team Members</option>
                    {/* Gather active users dynamically to guarantee option listings */}
                    {Array.from(
                      new Map(
                        [
                          ...ticketers.map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}` })),
                          ...assignments
                            .filter(a => a.userId && a.ticketerName)
                            .map(a => ({ id: a.userId!, name: a.ticketerName! }))
                        ].map(item => [item.id, item])
                      ).values()
                    ).map((user) => (
                      <option key={user.id} value={user.id} className="bg-black">
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
                     <div className="mt-6">
            {activeTab === 'ASSIGNMENTS' ? (
              <div>
                <p className="text-slate-500 text-xs mb-3 italic">
                  Showing rosters for: <strong className="text-slate-300">{assignmentDateLabel || 'Latest Schedule'}</strong>
                </p>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Opening Time</label>
              <input
                type="time"
                value={newLocOpeningTime}
                onChange={(e) => setNewLocOpeningTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Closing Time</label>
              <input
                type="time"
                value={newLocClosingTime}
                onChange={(e) => setNewLocClosingTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-linear-to-r from-emerald-400 to-teal-400 py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'Registering...' : 'Add Location'}
          </button>
        </form>
      </Drawer>


      {/* ADMIN: Edit Location Drawer */}
      <Drawer
        open={openEditLocationDrawer}
        title="Edit Terminal Location"
        subtitle="Update registered terminal location details"
        onClose={() => setOpenEditLocationDrawer(false)}
      >
        <form onSubmit={handleEditLocation} className="space-y-4">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Location Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Iyana Ipaja Bus-Stop"
              value={editLocName}
              onChange={(e) => setEditLocName(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Physical Address</label>
            <input
              type="text"
              required
              placeholder="e.g. 45 Abeokuta Expressway, Lagos"
              value={editLocAddress}
              onChange={(e) => setEditLocAddress(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Opening Time</label>
              <input
                type="time"
                value={editLocOpeningTime}
                onChange={(e) => setEditLocOpeningTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Closing Time</label>
              <input
                type="time"
                value={editLocClosingTime}
                onChange={(e) => setEditLocClosingTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-linear-to-r from-emerald-400 to-teal-400 py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'Updating...' : 'Save Changes'}
          </button>
        </form>
      </Drawer>



      {/* supperversor Assign/unassign Location */}

    <Drawer
        open={openAssignmentDrawer}
        title="Schedule Daily / Roster Mapping"
        subtitle="Assign a ticketer to a specific station roster"
        onClose={() => {
          setOpenAssignmentDrawer(false);
          // Clear selections to avoid stale state on next open
          setSelectedTicketer('');
          setSelectedLocation('');
          setBulkAssignments({});
          setAssignDate('');
          setAssignStartDate('');
          setAssignEndDate('');
        }}
      >
        <form onSubmit={handleAssignLocation} className="space-y-4">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Scheduling Mode</label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setAssignMode('single')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all ${assignMode === 'single' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-transparent border-white/10 text-slate-400'
                  }`}
              >
                Single Day
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('range')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all ${assignMode === 'range' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-transparent border-white/10 text-slate-400'
                  }`}
              >
                Roster Date Range (Full Month)
              </button>
            </div>
          </div>

          {assignMode === 'range' ? (
            <div className="space-y-4">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block">
                Assign Stations to Ticketers
              </label>

              {ticketers.map((t) => (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">
                      {t.first_name} {t.last_name}
                    </span>
                    <span className="text-[10px] text-slate-500">{t.email}</span>
                  </div>

                  <select
                    value={bulkAssignments[t.id] || ""}
                    onChange={(e) => {
                      const locationId = e.target.value;
                      setBulkAssignments((prev) => ({
                        ...prev,
                        [t.id]: locationId,
                      }));
                    }}
                    className="sm:w-64 w-full rounded-xl bg-white/3 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="" className="bg-black">Unassigned / Off Duty</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id} className="bg-black">
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                Select Ticketer
              </label>
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
          )}



          { assignMode === 'single' && <div>
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
          }
         
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

      {/* SUPERVISOR: Edit Assignment / Reassign Drawer */}
      <Drawer
        open={!!selectedEditAssignment}
        title="Reassign / Emergency Swap"
        subtitle={`Modify schedule assignment for ${selectedEditAssignment?.assignedFor}`}
        onClose={() => {
          setSelectedEditAssignment(null);
          setEditTicketer('');
          setEditLocation('');
        }}
      >
        <form onSubmit={handleUpdateAssignment} className="space-y-4">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Date</label>
            <input
              type="text"
              disabled
              value={selectedEditAssignment?.assignedFor || ''}
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Select Ticketer</label>
            <select
              required
              value={editTicketer}
              onChange={(e) => setEditTicketer(e.target.value)}
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
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
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

          <div className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Reassigning will automatically override any existing overlapping schedules for the new ticketer or station on this day.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-linear-to-r from-amber-400 to-orange-400 text-black py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'Updating...' : 'Confirm Reassignment'}
          </button>
        </form>
      </Drawer>

    </>
  );
}
