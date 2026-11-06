import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,      // Replace 3000 with your desired port
    // (Optional) Prevents Vite from falling back to another port if 3000 is occupied
  }
})