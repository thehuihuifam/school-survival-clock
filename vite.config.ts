import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  // GitHub Pages serves the app from https://<user>.github.io/school-survival-clock/,
  // so production builds made in CI need that base path.
  // Local dev/preview keep serving from '/' so nothing breaks while developing.
  const isPagesBuild = process.env.GITHUB_ACTIONS === 'true'

  return {
    plugins: [react()],
    base: command === 'build' && isPagesBuild ? '/school-survival-clock/' : '/',
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  }
})
