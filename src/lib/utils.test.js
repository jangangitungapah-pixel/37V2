import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('merges conflicting Tailwind utilities by keeping the latest class', () => {
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
  });

  it('supports conditional class values', () => {
    const isHidden = false;
    expect(cn('text-sm', isHidden && 'hidden', 'font-medium')).toBe('text-sm font-medium');
  });
});
