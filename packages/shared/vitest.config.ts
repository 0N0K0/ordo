import { defineConfig } from 'vitest/config';

/**
 * Unit tests of the shared logic, run twice: in a zone behind Paris and in one ahead of it, so that a day or a time
 * read in the zone of the machine (instead of Paris) fails.
 */
export default defineConfig({
  test: {
    projects: ['America/New_York', 'Asia/Tokyo'].map((zone) => ({
      extends: true,
      test: { name: zone, include: ['test/**/*.test.ts'], env: { TZ: zone } },
    })),
  },
});
