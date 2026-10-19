import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Frankfurt: next to the Neon database (aws-eu-central-1) and close to Bruges.
  regions: ["fra1"],
};
