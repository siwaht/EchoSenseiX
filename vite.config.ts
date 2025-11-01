import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
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
      input: path.resolve(__dirname, "client/index.html"),
      output: {
        // Optimize chunk names for caching
        chunkFileNames: 'js/[name]-[hash].js',
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
