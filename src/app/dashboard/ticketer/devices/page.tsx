"use client"
import React, { useEffect, useState, useCallback } from 'react';
import DevicesPage, { PosDeviceSession, LocationAssignment } from "@/app/dashboard/PosDevicesPage";
import api from '@/lib/axios';
import { useSession } from "next-auth/react";
import { toast } from 'react-toastify';
import axios from 'axios';

export default function TicketerDevicesRoute() {
  const { data: session } = useSession();
  const loggedInUserId = session?.user?.id;

  const [sessions, setSessions] = useState<PosDeviceSession[]>([]);
  const [locations, setLocations] = useState<LocationAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/ticketer/device');
      if (res.data.success) {
        setSessions(res.data.sessions || []);
        setLocations(res.data.locations || []);
      }
    } catch (err) {
      if(err instanceof axios.AxiosError)
      toast.error(err?.response?.data.message || "Error loading ticketer devices");
      else
      toast.error("Error loading ticketer devices");
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
      role="TICKETER"
      sessions={sessions}
      locations={locations}
      isLoading={loading}
      onRefresh={loadData}
      loggedInUserId={loggedInUserId}
    />
  );
}
