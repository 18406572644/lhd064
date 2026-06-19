import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import sveltePreprocess from 'svelte-preprocess'

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        scss: {
          prependData: `@use 'src/styles/variables' as *;`
        }
      })
    })
  ],
  server: {
    port: 5173,
    open: false
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
