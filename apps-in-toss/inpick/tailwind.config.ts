import type { Config } from "tailwindcss";
import baseConfig from "./inpick-source/tailwind.config";

export default {
  ...baseConfig,
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./inpick-source/src/**/*.{js,ts,jsx,tsx}",
  ],
} satisfies Config;
