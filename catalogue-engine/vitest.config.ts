import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup-env.ts'],
    // Integration tests hit a pooled Supabase connection over WAN; several sequential creates
    // in a beforeAll/it body can exceed vitest's 5-10s defaults, especially with multiple test
    // files' hooks and test bodies contending for pooler connections concurrently as the suite
    // has grown. This is network latency, not a hung test — 30s gives real hangs room to still
    // fail loudly.
    hookTimeout: 30000,
    testTimeout: 30000,
    // The Supabase free-tier Session pooler caps concurrent connections at 15. Each
    // *.integration.test.ts file opens its own PrismaClient (its own connection pool); running
    // 6+ such files in parallel (vitest's default) can exceed that cap and produce a real
    // "max clients reached" error that has nothing to do with the test's own correctness. Run
    // test files sequentially instead — slower, but correct against this specific infra limit.
    // If this package ever moves off the free-tier pooler (a dedicated/larger pool, or a local
    // Postgres), this can be removed.
    fileParallelism: false,
  },
});
