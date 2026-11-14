import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/ol/')) {
            return 'openlayers';
          }
          if (id.includes('node_modules/proj4/') || id.includes('node_modules/wkt-parser/')) {
            return 'proj4';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons';
          }
          return undefined;
        },
      },
    },
  },
});
