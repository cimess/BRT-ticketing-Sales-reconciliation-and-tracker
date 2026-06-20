import { DefaultSession } from "next-auth";
import { DashboardRoleUsers } from "@/types/types";

declare module "next-auth" {
  interface Session {
    user: {
      role: DashboardRoleUsers;
      company_id: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    company_id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    company_id: string;
  }
}