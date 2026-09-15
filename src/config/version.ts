/**
 * Configuración de Versión y Release del Sistema ERP
 */

export const APP_VERSION = "1.3.0";
export const APP_NAME = "Halley ERP Pro";
export const APP_SHORT_NAME = "HalleyERP";
export const APP_EDITION = "Enterprise Commercial & NIIF";
export const APP_CODENAME = "Polaris Core";
export const APP_BUILD_DATE = "2026-09-15";
export const APP_BUILD_NUMBER = "20260915.1";

export function getFullVersionString(): string {
  return `${APP_NAME} v${APP_VERSION} [${APP_CODENAME}] (${APP_EDITION}) - Build ${APP_BUILD_NUMBER}`;
}
