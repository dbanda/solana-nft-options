/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, options) => {
    if (!options.isServer) {
      config.target = 'web'
      config.resolve.fallback.fs = false
    }
    return config
  }
}

module.exports = nextConfig