import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom doesn't implement scrollTo — App.tsx calls it on every view
// change, harmless in a real browser, just noisy here without a stub.
window.scrollTo = () => {};

// vite.config.ts deliberately doesn't set test.globals: true, so
// @testing-library/react's automatic cleanup never registers itself —
// it only auto-detects under that flag. Without this, a render from one
// test stays mounted and bleeds into the next, which looks exactly like
// an application bug (content from a previous test "leaking" into the
// current one) until traced back to test setup. Same root cause
// PHASE_A_SUMMARY.md documented for the original routing tests.
afterEach(() => {
  cleanup();
});

class MockIntersectionObserver { constructor() {} observe() {} unobserve() {} disconnect() {} }
window.IntersectionObserver = MockIntersectionObserver as any;
