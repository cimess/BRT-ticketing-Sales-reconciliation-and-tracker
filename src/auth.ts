/// src/auth.ts
import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { DashboardRoleUsers } from "@/types/types";

// Determine if secure cookies are required (Production/HTTPS environments)
const useSecureCookies = 
  process.env.NODE_ENV === "production" && 
  !process.env.NEXTAUTH_URL?.startsWith("http://localhost") && 
  !process.env.NEXTAUTH_URL?.startsWith("http://192.168.0.197");

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
        const companyCode = (credentials.companyCode as string).toUpperCase();

        console.log("🔑 authorize request for:", { email, companyCode });

        const user = await prisma.user.findFirst({
          where: {
            email,
          },
          include: { company: true },
        });

        if (!user) {
          console.log("❌ authorize: user not found in DB with email:", email);
          return null;
        }

        console.log("👤 authorize: user found in DB:", { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          companyCodeInDb: user.company?.code 
        });

        // Throw custom Company Code mismatch error
        if (user.company.code !== companyCode) {
          console.log("❌ authorize: company code mismatch. DB:", user.company.code, "Provided:", companyCode);
          throw new CompanyCodeInvalidError();
        }

        // Check password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          console.log("❌ authorize: password validation failed");
          return null;
        }

        // Throw custom Restricted User error
        if (user.restricted) {
          console.log("❌ authorize: user is restricted");
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

  // Force secure flags explicitly in production to solve invalid prefix errors
  cookies: useSecureCookies ? {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
    csrfToken: {
      name: `__Host-authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  } : undefined,

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
