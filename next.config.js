/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Type-checking is done separately; skip it during production build
    // to avoid chalk/Deno incompatibility crash in the linting phase.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Deno's watchFs misinterprets absolute paths passed by Next.js,
    // causing "NotFound" errors with doubled project paths.
    // Using poll-based watching avoids this incompatibility.
    config.watchOptions = {
      ...config.watchOptions,
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
