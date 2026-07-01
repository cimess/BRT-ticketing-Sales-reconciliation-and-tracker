import { Float_Status, Roles } from "@prisma/client";



export type TopUpItem = {
  id: string;
  amount: number;
  allocated_from: TopUpSource;
  allocationNote: string | null;
  status: string;
  date_received: string;
};
export interface RoleFinancialSnapshot {
  success: boolean;
  message: string;
  data: {
    role: string;
    companyBalance: number;
    totalTopUp?: number;
    totalAllocated?: number;
    expectedRemittance?: number;
    circulatingFloat?: number;
    supervisorCash?: number;
    ledgerReconciliation?: {
      totalCredits?: number;
      totalDebits?: number;
      computedBalance?: number;
      drift?: number;
      isInSync?: boolean;
    };
    posSessionId?: string | null;
  };
}

export interface RoleSalesSnapshot {
  success: boolean;
  message: string;
  data: {
    role: string;
    totalSales: number;        // Sum of total_sold from SalesReports
    totalRemitted: number;      // Sum of CONFIRMED Remittance
    pendingRemittance: number;  // Sum of PENDING Remittance
    salesCount: number;
    companyRemitted?: number;
  };
}
export type GetTopUpsResponse = {
  success: boolean;
  message: string;
  status: number;
  topups: TopUpItem[];
  nextCursor: string | null;
};

export type CompanyFloatSnapshot = {
  success: boolean;
  message: string;
  status: number;
  data: {
    cachedBalance: number;
    computedBalance: number;
    totalTopUps: number;
    totalAllocated: number;
    drift: number;
    isInSync: boolean;
  } | null;
};

export type TicketerPosSessionSummary = {
  id: string;
  deviceName: string;
  serialNumber: string;
  status: string;
  assignedAt: Date;
  unassignedAt: Date | null;
};

export type TicketerPosSnapshot = {
  success: boolean;
  message: string;
  status: number;

  data: {
    pos_device_id: string;
    sessionStatus: string;
    deviceName: string;
    closingBalance: number;
    totalTopUp: number;
    effectiveOpening: number;
    expectedRemittance: number;
    sessionsList: TicketerPosSessionSummary[];
    topUp: {
      id: string;
      amount_allocated: number;
      pos_device_id: string;
      status: Float_Status;
      allocated_at: Date;
      from_user_name: string;
      from_user_role: Roles;
      to_device_name: string;
    }[];
  } | null;
};


export type TopUpSource = "COMPANY_RESERVE" | "GOVERNMENT_TOP_UP" | "EXTERNAL_OTHER_SOURCE"