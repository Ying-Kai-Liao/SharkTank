/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sharktank/contracts", "@sharktank/game-engine"]
};

export default nextConfig;
