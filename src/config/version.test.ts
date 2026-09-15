import { describe, it, expect } from 'vitest';
import { 
  APP_VERSION, 
  APP_NAME, 
  APP_EDITION, 
  APP_CODENAME, 
  getFullVersionString 
} from './version';

describe('Version & Release metadata', () => {
  it('defines valid semantic versioning', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(APP_VERSION).toBe('1.3.0');
  });

  it('contains proper enterprise branding', () => {
    expect(APP_NAME).toBe('Halley ERP Pro');
    expect(APP_EDITION).toContain('Enterprise');
    expect(APP_CODENAME).toBe('Polaris Core');
  });

  it('generates complete version string', () => {
    const fullStr = getFullVersionString();
    expect(fullStr).toContain('Halley ERP Pro v1.3.0');
    expect(fullStr).toContain('Enterprise');
    expect(fullStr).toContain('Polaris Core');
  });
});
