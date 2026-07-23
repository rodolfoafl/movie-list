import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "./db/client";
import { users } from "./db/schema";

// bcrypt hash of a random, unused string — never a real password.
// Used so unknown-email lookups still pay a bcrypt.compare cost, keeping
// timing indistinguishable from a wrong-password attempt.
const DUMMY_HASH =
  "$2b$10$fLXQkt1ykbqNhPwqORgkKOiO1mHHYgpHAiH5qqeH2f8cNOWtWdnyq";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        const passwordMatches = await bcrypt.compare(
          password,
          user?.passwordHash ?? DUMMY_HASH
        );

        if (!user || !passwordMatches) {
          return null;
        }

        return { id: user.id, email: user.email };
      },
    }),
  ],
});
