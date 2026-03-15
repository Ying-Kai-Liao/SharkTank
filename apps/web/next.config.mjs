/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sharktank/contracts", "@sharktank/game-engine"],
  serverExternalPackages: ["@langchain/core", "@langchain/langgraph", "openai", "zod"]
};

export default nextConfig;
