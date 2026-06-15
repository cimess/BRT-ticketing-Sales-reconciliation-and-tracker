import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { DashboardRoleUsers } from "@/types/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },

      async authorize(credentials) {
        // Safety Fallback Check
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        // Debug Point 1: If database completely misses the email
        if (!user) {
          console.log(`[AUTH CHECK] User not found for email: ${email}`);
          return null;
        }

        const isValid = await bcrypt.compare(
          password,
          user.password
        );

        // Debug Point 2: If the password hash fails verification
        if (!isValid) {
          console.log(`[AUTH CHECK] Password validation failed for user: ${email}`);
          return null;
        }

        return {
          id: user.id.toString(), // Auth.js strictly prefers ids as strings
          email: user.email,
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          role: user.role, 
        };
      },
    }),
  ],

  // 1. CRITICAL FOR NEXTAUTH V5 CREDENTIALS
  trustHost: true,

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // Secure session duration: 1 Day
    updateAge: 24 * 60 * 60, // Prevents NextAuth from updating the cookie on every request
  },

  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,

  callbacks: {
    async jwt({ token, user }) {
      
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as DashboardRoleUsers;
      }
      return session;
    },
  },
});
