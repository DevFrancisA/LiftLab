import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://devfrancisa.github.io/LiftLab/
export default defineConfig({
  base: '/LiftLab/',
  plugins: [react()],
});
