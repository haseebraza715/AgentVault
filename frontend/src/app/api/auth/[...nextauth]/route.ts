import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

const providers = [];

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    })
  );
}

if (process.env.GOOGLE_ID && process.env.GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    })
  );
}

const handler = NextAuth({
  providers,
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
