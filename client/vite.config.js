import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Only add this line if index.html is physically inside the client folder
  // root: 'client', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Ensure Vite finds the entry point regardless of folder structure
        main: path.resolve(__dirname, 'index.html'), 
      },
    },
  }
})