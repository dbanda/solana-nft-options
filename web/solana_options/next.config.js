/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: "./",
  loaders: ['style-loader', 'css-loader', 'less-loader'],
  webpack: (config, options) => {
    if (!options.isServer) {
      config.target = 'web'
      config.resolve.fallback.fs = false
    }
    return config
  }
}

module.exports = nextConfig