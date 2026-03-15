/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sharktank/ai-service", "@sharktank/contracts", "@sharktank/game-engine"],
  serverExternalPackages: ["@langchain/core", "@langchain/langgraph", "openai", "zod"]
};

export default nextConfig;
