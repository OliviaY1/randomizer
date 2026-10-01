import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

// Two pages: the app, and the small page the Microsoft sign-in popup returns to
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        main: resolve(root, 'index.html'),
        redirect: resolve(root, 'redirect.html'),
      },
    },
  },
})
