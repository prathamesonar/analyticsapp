/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/database"],

  async headers() {
    return [
      {
        // Apply these headers to all API routes
        source: "/api/:path*",
        headers: [
          // Allow requests from your frontend development server
          {
            key: "Access-Control-Allow-Origin",
            value: "full-analyticsps.vercel.app", 
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
