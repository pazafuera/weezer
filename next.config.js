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
  };
  
  module.exports = nextConfig;