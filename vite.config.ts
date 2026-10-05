import { defineConfig } from 'vite';

// BASE_PATH setzt der Pages-Workflow (z. B. /aschenthron/); lokal bleibt es '/'
export default defineConfig({ base: process.env.BASE_PATH ?? '/', test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] } });
