export default {
  base: './',
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    {
      name: 'remove-module-type',
      transformIndexHtml(html) {
        // Remove type="module" and crossorigin so the IIFE script runs on file://
        return html.replace(/type="module"\s+crossorigin\s*/g, '')
      },
    },
  ],
}
