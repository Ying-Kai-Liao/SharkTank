/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sharktank/ai-service", "@sharktank/contracts", "@sharktank/game-engine"]
};

export default nextConfig;
