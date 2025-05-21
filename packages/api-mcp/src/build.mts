import { defineConfig } from 'tsup';

// Create a configuration for both ESM and CJS outputs
export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    target: 'node18',
    outDir: 'dist',
    outExtension: () => ({
        js: '.js'
    })
}); 