/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Expose to client so next-auth SessionProvider can reach /api/auth/session
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};

export default nextConfig;
