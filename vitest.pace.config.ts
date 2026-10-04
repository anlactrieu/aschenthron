import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['src/**/*.sim.ts'], testTimeout: 300000 } });
