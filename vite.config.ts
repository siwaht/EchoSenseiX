import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // Add automatic JSX runtime for smaller bundles
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'], // Remove console calls
        passes: 2, // Multiple passes for better compression
      },
      mangle: {
        safari10: true, // Better Safari 10 support
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    rollupOptions: {
      output: {
        // Improved chunk splitting strategy
        manualChunks: (id) => {
          // Core React dependencies
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-core';
          }
          // Router
          if (id.includes('wouter')) {
            return 'router';
          }
          // UI components library
          if (id.includes('@radix-ui')) {
            return 'ui-components';
          }
          // Data fetching
          if (id.includes('@tanstack/react-query')) {
            return 'data-fetching';
          }
          // Forms
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'forms';
          }
          // Charts
          if (id.includes('recharts') || id.includes('d3')) {
            return 'charts';
          }
          // Icons
          if (id.includes('lucide-react') || id.includes('react-icons')) {
            return 'icons';
          }
          // Date utilities
          if (id.includes('date-fns')) {
            return 'date-utils';
          }
          // Payment
          if (id.includes('stripe')) {
            return 'payment';
          }
          // Large libraries
          if (id.includes('framer-motion')) {
            return 'animation';
          }
          // Node modules (vendor chunk)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Optimize chunk names for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `js/[name]-${facadeModuleId}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return `assets/[name]-[hash][extname]`;
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash][extname]`;
          } else if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return `fonts/[name]-[hash][extname]`;
          } else {
            return `assets/[name]-[hash][extname]`;
          }
        },
      },
      // Optimize tree shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
    },
    chunkSizeWarningLimit: 500, // Reduced to encourage smaller chunks
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize asset inlining
    assetsInlineLimit: 4096, // 4kb
    // Report compressed size
    reportCompressedSize: true,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'wouter',
      '@tanstack/react-query',
      'lucide-react',
      'date-fns',
      'clsx',
      'tailwind-merge',
    ],
    exclude: ['@stripe/stripe-js'], // Exclude large libraries that should be loaded separately
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Add headers for better caching in development
    headers: {
      'Cache-Control': 'public, max-age=31536000',
    },
  },
  // Performance optimizations
  esbuild: {
    legalComments: 'none', // Remove legal comments
    target: 'es2020',
  },
  // Enable experimental features for better performance
  experimental: {
    renderBuiltUrl(filename: string) {
      // Add CDN URL in production
      if (process.env.NODE_ENV === 'production' && process.env.CDN_URL) {
        return `${process.env.CDN_URL}/${filename}`;
      }
      return `/${filename}`;
    },
  },
});
