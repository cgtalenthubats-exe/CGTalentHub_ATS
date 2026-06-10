import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: [
    'react-d3-tree',
    'd3-selection',
    'd3-transition',
    'd3-zoom',
    'd3-dispatch',
    'd3-timer',
    'd3-interpolate',
    'd3-color',
    'd3-ease',
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        os: false,
        path: false,
        express: false,
      };
      // webpack treats "node:fs" etc. as a URI scheme and bypasses resolve.fallback,
      // so strip the "node:" prefix first to fall back to the plain module names above.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: any) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );
    }
    return config;
  },
};

export default nextConfig;
