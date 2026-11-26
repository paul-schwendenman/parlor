// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/**
 * Shared flat config for the whole monorepo (run from the root: `pnpm lint`).
 *
 * Hardening-focused rules (see docs/CORE-HARDENING-PLAN.md, Phase 0.3) start as
 * warnings so the existing backlog doesn't block CI; tighten to errors as the
 * backlog is burned down in Phase 3.
 */
export default tseslint.config(
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/.svelte-kit/**',
			'**/test-results/**',
			'**/playwright-report/**',
			// Throwaway audit repro scripts (see docs/audit-repros/README.md).
			'docs/audit-repros/**',
			// Agent worktrees are full repo checkouts (see .gitignore).
			'.claude/worktrees/**',
			'**/*.config.js',
			'**/*.config.ts',
		],
	},

	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	...svelte.configs['flat/recommended'],

	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte'],
			},
		},
	},

	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},

	{
		rules: {
			// --- Hardening rules (warn for now) ---
			'@typescript-eslint/no-floating-promises': 'warn',
			'@typescript-eslint/no-misused-promises': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'no-restricted-syntax': [
				'warn',
				{
					// `x as unknown as T` launders types past the checker; validate instead.
					selector: 'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
					message: 'Avoid `as unknown as T`; validate the value or fix the type instead.',
				},
			],

			// --- Svelte style rules: backlog, not hardening (warn for now) ---
			'svelte/no-navigation-without-resolve': 'warn',
			'svelte/require-each-key': 'warn',
			'svelte/no-useless-mustaches': 'warn',
			'svelte/prefer-writable-derived': 'warn',

			// --- Noise reduction for an existing codebase ---
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
			],
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
		},
	},

	{
		// Files outside every build tsconfig: server entry points, e2e specs, and the
		// multiplayer tests (that package's tsconfig excludes them from its build). They
		// are type-checked through lint-only `tsconfig.eslint.json` projects instead of
		// the project service. The globs pick up new files (e.g. new *.test.ts) automatically.
		// apps/*/src/**/*.test.ts needs nothing here: the SvelteKit tsconfig includes src/**.
		files: [
			'apps/*/server/**/*.ts',
			'apps/*/e2e/**/*.ts',
			'games/*/server/**/*.ts',
			'packages/multiplayer/src/**/*.test.ts',
		],
		languageOptions: {
			parserOptions: {
				projectService: false,
				project: [
					'./apps/*/tsconfig.eslint.json',
					'./games/*/tsconfig.eslint.json',
					'./packages/multiplayer/tsconfig.eslint.json',
				],
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},

	{
		// Tests: allow looser typing.
		files: ['**/*.test.ts', '**/e2e/**'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/unbound-method': 'off',
			'no-restricted-syntax': 'off',
		},
	},
);
