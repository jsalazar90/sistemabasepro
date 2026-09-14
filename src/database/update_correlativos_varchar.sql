-- ==============================================================================
-- ACTUALIZACIÓN DE CORRELATIVOS EN CONFIGURACIÓN CONTABLE A TEXTO (VARCHAR)
-- Ejecutar en el Editor SQL de Supabase para que la base de datos almacene
-- los ceros a la izquierda de forma persistente (ejemplo: '000001').
-- ==============================================================================

ALTER TABLE configuracion_contable 
  ALTER COLUMN correlativo_factura TYPE VARCHAR(20) USING LPAD(correlativo_factura::text, 6, '0'),
  ALTER COLUMN correlativo_cotizacion TYPE VARCHAR(20) USING LPAD(correlativo_cotizacion::text, 6, '0'),
  ALTER COLUMN correlativo_nota_entrega TYPE VARCHAR(20) USING LPAD(correlativo_nota_entrega::text, 6, '0'),
  ALTER COLUMN correlativo_recibo TYPE VARCHAR(20) USING LPAD(correlativo_recibo::text, 6, '0');
