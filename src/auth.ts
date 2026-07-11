/// src/auth.ts
import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { DashboardRoleUsers } from "@/types/types";

// Determine if secure cookies are required (Production/HTTPS environments)
const useSecureCookies = 
  process.env.NODE_ENV === "production" && 
  !process.env.AUTH_URL?.startsWith("http://localhost") && 
  !process.env.AUTH_URL?.startsWith("http://192.168.0.197");

// Define custom error classes
class CompanyCodeInvalidError extends CredentialsSignin {
  code = "company_code_invalid";
}

class RestrictedUserError extends CredentialsSignin {
  code = "restricted";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        companyCode: { label: "Company Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !credentials?.companyCode) {
          console.log("❌ authorize: missing fields", { credentials });
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const companyCode = credentials.companyCode as string;

        // Find the user by email
        const user = await prisma.user.findFirst({
          where: { company: {code: companyCode},email },
          include: { company: true },
        });

        if (!user) {
          console.log("❌ authorize: user not found in DB");
          return null;
        }

        console.log("👤 authorize: user found in DB:", {
          id: user.id,
          email: user.email,
          role: user.role,
          companyCodeInDb: user.company?.code,
        });

        // Validate company code
        if (user.company?.code.toUpperCase() !== companyCode.toUpperCase()) {
          console.log("❌ authorize: company code invalid");
          throw new CompanyCodeInvalidError();
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          console.log("❌ authorize: password invalid");
          return null;
        }

        // Check if user account is restricted/inactive
        if (user.restricted) {
          console.log("❌ authorize: user account restricted");
          throw new RestrictedUserError();
        }

        console.log("✅ authorize: password matches, user authorized successfully.");
        return {
          id: user.id.toString(),
          email: user.email,
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          role: user.role,
          company_id: user.company_id,
        };
      },
    }),
  ],
  trustHost: true,
  useSecureCookies: useSecureCookies, // Forces secure cookies in prod using default names

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.company_id = user.company_id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as DashboardRoleUsers;
        session.user.company_id = token.company_id as string;
      }
      return session;
    },
  },
});
