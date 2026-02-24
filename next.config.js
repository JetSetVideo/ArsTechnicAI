/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  
  // Webpack configuration for Deno compatibility
  webpack: (config, { dev }) => {
    if (dev) {
      // Suppress source map-related warnings in development
      // The source map parsing error is a known Deno/Next.js compatibility issue
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    return config;
  },
  
  // Build activity indicator position
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },

  // Optional cross-machine API proxy:
  // When API_PROXY_TARGET is set (for example to your Ubuntu server),
  // local frontend /api calls are forwarded to that backend.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.trim();
    if (!target) return [];

    return [
      {
        source: '/api/:path*',
        destination: `${target.replace(/\/+$/, '')}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
