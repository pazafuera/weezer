/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
      // Warning: This allows production builds to successfully complete even if
      // your project has ESLint errors (like unescaped quotes).
      ignoreDuringBuilds: true,
    },
    typescript: {
      // Allows production builds to finish even if type errors exist
      ignoreBuildErrors: true,
    },
    env: {
      // Build stamp for the stale-build self-check
      // (components/BuildVersionCheck): Vercel sets
      // VERCEL_GIT_COMMIT_SHA during the build; empty anywhere
      // else, which disables the check.
      NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || '',
    },
  };
  
  module.exports = nextConfig;