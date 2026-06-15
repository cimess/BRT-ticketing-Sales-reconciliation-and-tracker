import { DefaultSession } from "next-auth";
import { DashboardRoleUsers } from "@/types/types";

declare module "next-auth" {
  interface Session {
    user: {
      role: DashboardRoleUsers;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
  }
}