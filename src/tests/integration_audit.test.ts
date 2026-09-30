import { describe, it, expect } from 'vitest';
import { runSystemAudit } from './integration_audit';

describe('Auditoría Contable NIIF y Enlace de Módulos (Partida Doble)', () => {
  const auditResults = runSystemAudit();

  auditResults.forEach((res) => {
    it(res.test, () => {
      expect(res.status).toBe('PASSED');
      expect(Math.abs(res.debe - res.haber)).toBeLessThan(0.01);
      expect(res.debe).toBeGreaterThan(0);
    });
  });
});
