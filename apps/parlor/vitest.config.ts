import { defineConfig } from 'vitest/config';

// Standalone config (not vite.config.ts) so unit tests don't boot SvelteKit or the dev socket plugin.
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
	},
});
