// Vitest global setup — registers @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveTextContent, etc.) and an afterEach hook that
// auto-cleans the rendered DOM between tests.

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
