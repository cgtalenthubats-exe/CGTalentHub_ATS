import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // export-pptx.ts reads public/linkedin-logo.png via fs at runtime to embed it in
  // generated PPTX files. Files under public/ aren't traced into the serverless
  // function bundle by default, so without this the read 404s in production
  // (ENOENT) for every route that imports export-pptx.ts.
  outputFileTracingIncludes: {
    '/**': ['./public/linkedin-logo.png'],
  },
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
