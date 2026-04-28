import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

describe('useFocusTrap', () => {
  let opener: HTMLButtonElement;

  beforeEach(() => {
    // Note: avoid id='opener' — happy-dom mirrors it onto window.opener
    // which is a read-only getter and throws.
    opener = document.createElement('button');
    opener.textContent = 'Open';
    opener.dataset['testid'] = 'trigger';
    document.body.appendChild(opener);
    opener.focus();
  });

  afterEach(() => {
    opener.remove();
  });

  it('returns a ref object with current=null initially', () => {
    const { result } = renderHook(() => useFocusTrap<HTMLDivElement>(false));
    expect(result.current).toHaveProperty('current');
    expect(result.current.current).toBe(null);
  });

  it('does not steal focus when inactive', () => {
    expect(document.activeElement).toBe(opener);
    renderHook(() => useFocusTrap(false));
    expect(document.activeElement).toBe(opener);
  });

  it('restores focus to the previously-focused element on cleanup when active', () => {
    expect(document.activeElement).toBe(opener);
    const { unmount } = renderHook(() => useFocusTrap(true));
    // After unmount, focus should return to opener.
    unmount();
    expect(document.activeElement).toBe(opener);
  });

  it('does not restore focus when restore: false is passed', () => {
    const sink = document.createElement('button');
    document.body.appendChild(sink);
    const { unmount } = renderHook(() => useFocusTrap(true, { restore: false }));
    sink.focus(); // simulate user moving focus away while trap is active
    expect(document.activeElement).toBe(sink);
    unmount();
    // restore disabled — focus should remain on sink, not bounce to opener.
    expect(document.activeElement).toBe(sink);
    sink.remove();
  });
});
