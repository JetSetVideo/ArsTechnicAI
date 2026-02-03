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
};

export default nextConfig;
