// src/app/dashboard/LocationPage.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Calendar, Plus, Search, Trash2, UserCheck, AlertTriangle, Edit, Copy, ChevronRight, X, Clock, User as UserIcon } from 'lucide-react';
import { PageScaffold } from '@/components/pageScaffold';
import { Drawer } from '@/components/Drawer';
import { toast } from 'react-toastify';
import api from '../lib/axios';
import axios from 'axios';

interface Location {
  id: string;
  name: string;
  address: string;
  staff_count: number;
  opening_time?: string | null;
  closing_time?: string | null;
}

interface LocationAssignment {
  id: string;
  assignmentId: string;
  locationName: string;
  locationAddress: string;
  assignedFor: string;
  session: 'MORNING' | 'EVENING';
  userId?: string;
  ticketerName?: string;
  ticketerEmail?: string;
  createdByName?: string;
  createdById?: string;
}

interface UserListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  restricted: boolean;
}

type TabType = 'ROSTER' | 'LOCATIONS';

export default function LocationsPage({ role = 'TICKETER' }: { role?: string }) {
  const userRole = (role?.toUpperCase() || 'TICKETER') as 'TICKETER' | 'SUPERVISOR' | 'ADMIN';

  const [activeTab, setActiveTab] = useState<TabType>('ROSTER');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');
  
  // Data State
  const [locations, setLocations] = useState<Location[]>([]);
  const [assignments, setAssignments] = useState<LocationAssignment[]>([]);
  const [ticketers, setTicketers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter scope toggles
  const [scope, setScope] = useState<'personal' | 'team'>(userRole === 'TICKETER' ? 'personal' : 'team');

  // Form Staging for Assignments (Templates & Creating)
  const [selectedAssignDate, setSelectedAssignDate] = useState('');
  const [stagedRows, setStagedRows] = useState<Array<{
    userId: string;
    locationId: string;
    session: 'MORNING' | 'EVENING';
  }>>([{ userId: '', locationId: '', session: 'MORNING' }]);

  // Drawers
  const [openCreateDrawer, setOpenCreateDrawer] = useState(false);
  const [selectedDetailsAssignment, setSelectedDetailsAssignment] = useState<LocationAssignment | null>(null);
  
  // Overwrite Warning Dialog Modal State
  const [conflictData, setConflictData] = useState<{ date: string; message: string } | null>(null);

  // Admin Location Form State
  const [openLocationDrawer, setOpenLocationDrawer] = useState(false);
  const [selectedEditLocation, setSelectedEditLocation] = useState<Location | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locStaffCount, setLocStaffCount] = useState(1);
  const [locOpeningTime, setLocOpeningTime] = useState('');
  const [locClosingTime, setLocClosingTime] = useState('');

  // Fetch Locations
  const fetchLocations = useCallback(async () => {
    try {
      const res = await api.get('/locations');
      if (res.data?.success) setLocations(res.data.data);
    } catch (e) {
      toast.error('Failed to load locations');
    }
  }, []);

  // Fetch Assignments
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('scope', scope);
      if (filterDate) {
        params.append('date', filterDate);
      }
      const res = await api.get(`/locations/assignments?${params.toString()}`);
      if (res.data?.success) setAssignments(res.data.data);
    } catch (e) {
      toast.error('Failed to load rosters');
    } finally {
      setLoading(false);
    }
  }, [scope, filterDate]);

  // Fetch active, non-restricted ticketers
  const fetchTicketers = useCallback(async () => {
    try {
      const url = userRole === 'SUPERVISOR' ? '/api/supervisor/user' : '/api/admin/user?role=TICKETER';
      const res = await fetch(url);
      const data = await res.json() as {
        success: boolean;
        data: Array<{
          id?: string;
          user_id?: string;
          username?: string;
          first_name?: string;
          last_name?: string;
          email: string;
          restricted?: boolean;
        }>;
      };

      if (data.success) {
        const list: UserListItem[] = userRole === 'SUPERVISOR'
          ? data.data.map((u) => ({
              id: u.id || u.user_id || '',
              first_name: u.first_name || '',
              last_name: u.last_name || '',
              email: u.email,
              restricted: u.restricted || false
            }))
          : data.data.map((u) => ({
              id: u.user_id || u.id || '',
              first_name: u.username?.split(' ')[0] || u.first_name || '',
              last_name: u.username?.split(' ')[1] || u.last_name || '',
              email: u.email,
              restricted: u.restricted || false
            }));
        // Filter out restricted users during assignment creation
        setTicketers(list.filter((u) => !u.restricted));
      }
    } catch (e) {
     if(e instanceof axios.AxiosError){
      toast.error(e?.response?.data.message || "Failed to load ticketers.");
     }else{
      toast.error("Failed to load ticketers.");
     }
    }
  }, [userRole]);

  useEffect(() => {
    let active = true;

    // Use a microtask/setTimeout to prevent synchronous state changes inside the effect body
    const timer = setTimeout(() => {
      if (!active) return;
      fetchLocations();
      fetchAssignments();
      if (userRole !== 'TICKETER') {
        fetchTicketers();
      }
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchLocations, fetchAssignments, fetchTicketers, userRole, scope]);

  // Handle Create Location (Admin)
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName || !locAddress) return toast.error('Name and Address are required.');
    
    setSubmitting(true);
    try {
      const payload = {
        name: locName,
        address: locAddress,
        staff_count: Number(locStaffCount),
        opening_time: locOpeningTime || null,
        closing_time: locClosingTime || null,
      };

      let res;
      if (selectedEditLocation) {
        res = await api.patch<{ success: boolean; message?: string }>('/locations', { id: selectedEditLocation.id, ...payload });
      } else {
        res = await api.post<{ success: boolean; message?: string }>('/locations', payload);
      }

      if (res.status === 200) {
        toast.success(selectedEditLocation ? 'Location updated' : 'Location created');
        setOpenLocationDrawer(false);
        setSelectedEditLocation(null);
        setLocName('');
        setLocAddress('');
        setLocStaffCount(1);
        setLocOpeningTime('');
        setLocClosingTime('');
        fetchLocations();
      }
    } catch (error) {
      if (error instanceof axios.AxiosError) {
        toast.error(error.response?.data?.message || 'Failed to save location.');
      } else {
        toast.error('Failed to save location.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Submit assignments batch
  const handleSaveAssignments = async (force: boolean = false) => {
    if (!selectedAssignDate) return toast.error('Please pick a target date.');
    
    const validRows = stagedRows.filter(r => r.userId && r.locationId);
    if (validRows.length === 0) return toast.error('Please add at least one complete assignment.');

    setSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; message?: string; conflict?: boolean }>('/locations/assignments', {
        date: selectedAssignDate,
        forceReplace: force,
        assignments: validRows
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Roster scheduled successfully');
        setOpenCreateDrawer(false);
        setConflictData(null);
        fetchAssignments();
      }
    } catch (error) {
      if (error instanceof axios.AxiosError) {
        // Trigger override dialog warning
        setConflictData({
          date: selectedAssignDate,
          message: error.response?.data?.message || error.response?.data?.error ||'Error scheduling roster'
        });
        toast.error(error.response?.data?.message || error.response?.data?.error ||'Error scheduling roster');
      } else {
        toast.error('Error scheduling roster');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Clone/Copy past roster to staging inputs
  const handleCloneRoster = (dateString: string) => {
    // Get all assignments for this specific date
    const dayAssignments = assignments.filter(a => a.assignedFor === dateString);
    if (dayAssignments.length === 0) return;

    // Map day assignments to staged inputs, filtering out deleted/inactive ticketers
    const prefilled = dayAssignments
      .map(a => {
        const userExists = ticketers.some(t => t.id === a.userId);
        return {
          userId: userExists ? a.userId! : '',
          locationId: a.id,
          session: a.session
        };
      });

    setStagedRows(prefilled.length > 0 ? prefilled : [{ userId: '', locationId: '', session: 'MORNING' }]);
    setSelectedAssignDate(''); // Clear date so supervisor picks a future one
    setOpenCreateDrawer(true);
    toast.info(`Prefilled setup from ${dateString}. Select a date to save.`);
  };

  // Delete individual assignment
  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    try {
      const res = await api.delete<{ success: boolean; message?: string }>(`/locations/assignments?id=${id}`);
      if (res.data?.success) {
        toast.success('Assignment removed');
        setSelectedDetailsAssignment(null);
        fetchAssignments();
      }
    } catch (error) {
      if (error instanceof axios.AxiosError ) {
        // Trigger override dialog warning
        setConflictData({
          date: selectedAssignDate,
          message: error.response?.data?.message
        });
        toast.error(error.response?.data?.message || 'Failed to remove assignment');
      } else {
        toast.error('Failed to remove assignment');
      }
    }
  };

  // Group assignments by Date for card display
  const groupedAssignments = React.useMemo(() => {
    const groups: Record<string, LocationAssignment[]> = {};
    assignments.forEach(a => {
      if (!groups[a.assignedFor]) groups[a.assignedFor] = [];
      groups[a.assignedFor].push(a);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [assignments]);

  return (
    <>
      <PageScaffold
        title="Locations & Roster"
        subtitle={userRole === 'TICKETER' ? 'Your shift assignments and terminal layout' : 'Create, edit, and copy daily station assignments'}
        right={
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-white/10 bg-white/3 p-1">
              <button
                onClick={() => setActiveTab('ROSTER')}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === 'ROSTER' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                Roster
              </button>
              <button
                onClick={() => setActiveTab('LOCATIONS')}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === 'LOCATIONS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                Locations
              </button>
            </div>

            {userRole === 'ADMIN' && activeTab === 'LOCATIONS' && (
              <button
                onClick={() => {
                  setSelectedEditLocation(null);
                  setLocName('');
                  setLocAddress('');
                  setLocStaffCount(1);
                  setLocOpeningTime('');
                  setLocClosingTime('');
                  setOpenLocationDrawer(true);
                }}
                className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-bold"
              >
                <Plus className="size-4" />
              </button>
            )}

            {userRole === 'SUPERVISOR' && activeTab === 'ROSTER' && (
              <button
                onClick={() => {
                  setStagedRows([{ userId: '', locationId: '', session: 'MORNING' }]);
                  setSelectedAssignDate('');
                  setOpenCreateDrawer(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all text-xs font-bold uppercase"
              >
                <Plus className="size-4" /> Create Roster
              </button>
            )}
          </div>
        }
      >
        {/* FILTERS */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-white/5 bg-white/3 rounded-2xl">
          <div className="flex items-center gap-3 bg-white/3 border border-white/10 rounded-xl px-3 py-2 w-full max-w-sm">
            <Search className="size-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search station or ticketer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-600 w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeTab === 'ROSTER' && (
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-white/3 border border-white/10 text-xs text-white rounded-xl px-3 py-2 focus:outline-none"
              />
            )}

            {activeTab === 'ROSTER' && userRole === 'TICKETER' && (
              <div className="inline-flex rounded-full border border-white/10 bg-white/3 p-1">
                <button
                  onClick={() => setScope('personal')}
                  className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase ${
                    scope === 'personal' ? 'bg-white/10 text-white' : 'text-slate-500'
                  }`}
                >
                  My Shift
                </button>
                <button
                  onClick={() => setScope('team')}
                  className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase ${
                    scope === 'team' ? 'bg-white/10 text-white' : 'text-slate-500'
                  }`}
                >
                  Team View
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CONTENTS */}
        {loading ? (
          <div className="text-center py-10 text-slate-500 text-xs">Loading rosters...</div>
        ) : activeTab === 'ROSTER' ? (
          groupedAssignments.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-xs italic">No rosters scheduled for this date query.</div>
          ) : (
            <div className="space-y-4">
              {groupedAssignments.map(([dateString, dayList]) => (
                <div
                  key={dateString}
                  className="p-4 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 transition-all cursor-pointer relative"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-indigo-400" />
                      <span className="text-sm font-bold text-white">
                        {new Date(dateString).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    {userRole === 'SUPERVISOR' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneRoster(dateString);
                        }}
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-white uppercase bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 transition-all"
                      >
                        <Copy className="size-3" /> Clone
                      </button>
                    )}
                  </div>

                  {/* List of assignments in date */}
                  <div className="space-y-2">
                    {dayList
                      .filter(a => 
                        a.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (a.ticketerName || '').toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(a => (
                        <div
                          key={a.assignmentId}
                          onClick={() => setSelectedDetailsAssignment(a)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/3 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              a.session === 'MORNING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}>
                              {a.session}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-white">{a.locationName}</p>
                              <p className="text-[10px] text-slate-500">{a.ticketerName || 'Unassigned'}</p>
                            </div>
                          </div>
                          <ChevronRight className="size-4 text-slate-600" />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* LOCATIONS TAB */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {locations
              .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.address.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(l => (
                <div key={l.id} className="p-4 border border-white/5 bg-white/3 rounded-2xl flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{l.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin className="size-3" /> {l.address}</p>
                    <div className="flex gap-4 mt-3 text-[10px] text-slate-400">
                      <span>👤 Capacity: <strong>{l.staff_count} per session</strong></span>
                      {l.opening_time && <span>⏰ {l.opening_time} - {l.closing_time}</span>}
                    </div>
                  </div>
                  {userRole === 'ADMIN' && (
                    <button
                      onClick={() => {
                        setSelectedEditLocation(l);
                        setLocName(l.name);
                        setLocAddress(l.address);
                        setLocStaffCount(l.staff_count);
                        setLocOpeningTime(l.opening_time || '');
                        setLocClosingTime(l.closing_time || '');
                        setOpenLocationDrawer(true);
                      }}
                      className="p-2 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all"
                    >
                      <Edit className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </PageScaffold>

      {/* DRAWER: Assignment details (Mobile slide-up sheet) */}
      <Drawer
        open={!!selectedDetailsAssignment}
        title="Assignment Details"
        subtitle="Full operational schedule details"
        onClose={() => setSelectedDetailsAssignment(null)}
      >
        {selectedDetailsAssignment && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
              <div>
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Location</label>
                <span className="text-sm font-bold text-white mt-1 block">{selectedDetailsAssignment.locationName}</span>
                <span className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><MapPin className="size-3" /> {selectedDetailsAssignment.locationAddress}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Date</label>
                  <span className="text-xs font-semibold text-slate-200 mt-1 block">{selectedDetailsAssignment.assignedFor}</span>
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Session</label>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${
                    selectedDetailsAssignment.session === 'MORNING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {selectedDetailsAssignment.session}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
              <div>
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Ticketer Staff</label>
                <span className="text-sm font-bold text-white mt-1 block">{selectedDetailsAssignment.ticketerName}</span>
                <span className="text-xs text-slate-400 mt-0.5 block">{selectedDetailsAssignment.ticketerEmail}</span>
                {userRole === 'ADMIN' && (
                  <span className="text-[10px] text-slate-500 mt-1 block">Staff ID: {selectedDetailsAssignment.userId}</span>
                )}
              </div>
              <div>
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Assigned By</label>
                <span className="text-xs font-semibold text-slate-200 mt-1 block">{selectedDetailsAssignment.createdByName}</span>
                {userRole === 'ADMIN' && (
                  <span className="text-[10px] text-slate-500 mt-1 block">Creator ID: {selectedDetailsAssignment.createdById}</span>
                )}
              </div>
            </div>

            {userRole === 'SUPERVISOR' && (
              <button
                onClick={() => handleDeleteAssignment(selectedDetailsAssignment.assignmentId)}
                className="w-full rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Trash2 className="size-4" /> Cancel Assignment / Shift
              </button>
            )}
          </div>
        )}
      </Drawer>

      {/* DRAWER: Create / Pre-fill Roster */}
      <Drawer
        open={openCreateDrawer}
        title="Schedule Roster"
        subtitle="Configure daily terminal staff mappings"
        onClose={() => setOpenCreateDrawer(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">Target Date</label>
            <input
              type="date"
              value={selectedAssignDate}
              onChange={(e) => setSelectedAssignDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]} // Front-end past-date lock
              className="w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Assignments list</label>
              <button
                onClick={() => setStagedRows([...stagedRows, { userId: '', locationId: '', session: 'MORNING' }])}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase"
              >
                + Add Row
              </button>
            </div>

            {stagedRows.map((row, index) => (
              <div key={index} className="p-3 bg-white/3 border border-white/5 rounded-xl space-y-3 relative">
                {stagedRows.length > 1 && (
                  <button
                    onClick={() => setStagedRows(stagedRows.filter((_, i) => i !== index))}
                    className="absolute top-2 right-2 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <label className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Location</label>
                    <select
                      value={row.locationId}
                      onChange={(e) => {
                        const next = [...stagedRows];
                        next[index].locationId = e.target.value;
                        setStagedRows(next);
                      }}
                      className="w-full rounded-lg bg-white/3 border border-white/10 p-2 text-xs text-white focus:outline-none mt-1"
                    >
                      <option value="" className="bg-black">Choose location...</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id} className="bg-black">{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Shift Session</label>
                    <select
                      value={row.session}
                      onChange={(e) => {
                        const next = [...stagedRows];
                        next[index].session = e.target.value as 'MORNING' | 'EVENING';
                        setStagedRows(next);
                      }}
                      className="w-full rounded-lg bg-white/3 border border-white/10 p-2 text-xs text-white focus:outline-none mt-1"
                    >
                      <option value="MORNING" className="bg-black">MORNING</option>
                      <option value="EVENING" className="bg-black">EVENING</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Ticketer Staff</label>
                  <select
                    value={row.userId}
                    onChange={(e) => {
                      const next = [...stagedRows];
                      next[index].userId = e.target.value;
                      setStagedRows(next);
                    }}
                    className="w-full rounded-lg bg-white/3 border border-white/10 p-2 text-xs text-white focus:outline-none mt-1"
                  >
                    <option value="" className="bg-black">Select ticketer...</option>
                    {ticketers.map(t => (
                      <option key={t.id} value={t.id} className="bg-black">{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => handleSaveAssignments(false)}
            disabled={submitting}
            className="w-full rounded-xl bg-linear-to-r from-indigo-400 to-violet-400 py-3 text-sm font-bold text-black active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'Scheduling Roster...' : 'Save Assignments'}
          </button>
        </div>
      </Drawer>

      {/* ADMIN: Add/Edit Location Drawer */}
      <Drawer
        open={openLocationDrawer}
        title={selectedEditLocation ? "Edit Station Location" : "Add Station Location"}
        subtitle="Register terminal coordinates and capacities"
        onClose={() => setOpenLocationDrawer(false)}
      >
        <form onSubmit={handleSaveLocation} className="space-y-4">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Location Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Oshodi Terminal 1"
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Address</label>
            <input
              type="text"
              required
              placeholder="e.g. Oshodi Expressway, Lagos"
              value={locAddress}
              onChange={(e) => setLocAddress(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Session Capacity</label>
              <input
                type="number"
                min="1"
                required
                value={locStaffCount}
                onChange={(e) => setLocStaffCount(Number(e.target.value))}
                className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Opening Time</label>
              <input
                type="time"
                value={locOpeningTime}
                onChange={(e) => setLocOpeningTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Closing Time</label>
            <input
              type="time"
              value={locClosingTime}
              onChange={(e) => setLocClosingTime(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-linear-to-r from-emerald-400 to-teal-400 py-3 text-sm font-bold text-black active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'Saving Location...' : 'Save Location'}
          </button>
        </form>
      </Drawer>

      {/* OVERWRITE WARNING OVERLAY DIALOG MODAL */}
      {conflictData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3 text-amber-400">
              <AlertTriangle className="size-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Overwrite Roster?</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{conflictData.message}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setConflictData(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold uppercase transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveAssignments(true)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 text-xs font-bold uppercase transition-all disabled:opacity-50"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
