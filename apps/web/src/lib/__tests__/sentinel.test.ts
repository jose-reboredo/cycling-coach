// Sentinel — proves Vitest is wired and the happy-dom env loads. Will be
// joined by real lib unit tests as v8.5.0+ phases touch the libraries.

import { describe, expect, it } from 'vitest';

describe('test harness sentinel', () => {
  it('runs vitest with happy-dom env', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
    expect(true).toBe(true);
  });

  it('runs jest-dom matchers via setup', () => {
    const el = document.createElement('div');
    el.textContent = 'hello';
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('hello');
    el.remove();
  });
});
