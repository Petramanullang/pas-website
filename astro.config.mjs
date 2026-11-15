// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://petrajm.tech',
  integrations: [sitemap({ filter: (page) => !page.includes('/ulasan') && !page.includes('/admin') })],
  build: { inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
