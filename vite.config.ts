/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // The app is published to https://thehuihuifam.github.io/school-survival-clock/
  // but is also served from '/' by `vite dev`, so production builds use a
  // *relative* base: every emitted URL (scripts, styles, the tick worker, the
  // manifest, the icons) then resolves against the document itself and keeps
  // working under any sub-path — no hard-coded `/school-survival-clock/`.
  base: command === 'build' ? './' : '/',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    reportCompressedSize: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
}))
