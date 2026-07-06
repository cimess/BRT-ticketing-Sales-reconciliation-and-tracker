"use client"
import React, { useEffect, useState, useCallback } from 'react';
import DevicesPage, { PosDevice, PosDeviceSession, AvailableUser } from "@/app/dashboard/PosDevicesPage";
import api from '@/lib/axios';
import { toast } from 'react-toastify';
import axios from 'axios';

export default function SupervisorDevicesRoute() {
  const [devices, setDevices] = useState<PosDevice[]>([]);
  const [sessions, setSessions] = useState<PosDeviceSession[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/supervisor/device');
      if (res.data.success) {
        setDevices(res.data.devices || []);
        setSessions(res.data.sessions || []);
        setAvailableUsers(res.data.availableUsers || []);
      }
    } catch (err) {
      if(err instanceof axios.AxiosError)
      toast.error(err?.response?.data.message || "Error loading supervisor devices");
      else
      toast.error("Error loading supervisor devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (active) {
        await loadData();
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [loadData]);

  return (
    <DevicesPage
      role="SUPERVISOR"
      devices={devices}
      sessions={sessions}
      availableUsers={availableUsers}
      isLoading={loading}
      onRefresh={loadData}
    />
  );
}
