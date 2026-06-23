import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000, // Account for containerlab startup time
  fullyParallel: false, // Run tests sequentially since they manipulate docker containers
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Ensure we can reuse already running servers
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
    {
      command: 'cd ../backend && PYTHONPATH=src .venv/bin/python -m uvicorn app.main:app --port 8000',
      url: 'http://localhost:8000/api/v1/topology/status',
      reuseExistingServer: true,
    }
  ],
});
