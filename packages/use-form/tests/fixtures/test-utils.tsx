import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * Custom render function that can be extended with providers
 */
export function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options });
}

/**
 * Re-export everything from testing library
 */
export * from '@testing-library/react';
export { customRender as render };
