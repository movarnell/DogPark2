import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default {
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
  },
};
