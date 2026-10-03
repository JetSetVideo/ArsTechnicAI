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
  // public/ files created after the build (generated or pulled by sync) are not
  // served by Next in production; fall back to a route that reads them from disk.
  async rewrites() {
    return {
      fallback: [{ source: '/generated/:name', destination: '/api/files/generated/:name' }],
    };
  },
  // Security headers on every response (middleware/securityMiddleware.ts was never
  // wired into any route). The CSP is deliberately narrow — framing, plugins, base
  // and form targets — because the UI relies on inline styles and calls AI
  // providers directly; a script/style CSP would need a nonce pass first.
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com",
      },
    ];
    return [
      { source: '/:path*', headers: security },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
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
