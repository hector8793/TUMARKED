-- =========================================================
-- TUMARKED - BORRADO DEL CATÁLOGO DE PRODUCTOS
-- =========================================================
-- Conserva clientes, entregas y transacciones.
--
-- PostgreSQL impedirá borrar productos que tengan historial en
-- transaction_items o stock_movements. En un ambiente de desarrollo,
-- ejecuta primero Docs/limpiar_transacciones.sql si deseas limpiar
-- también esas referencias.
--
-- ADVERTENCIA: esta operación es destructiva.
-- =========================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM transaction_items LIMIT 1)
       OR EXISTS (SELECT 1 FROM stock_movements LIMIT 1) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'No se pueden borrar los productos porque tienen historial transaccional.',
            HINT = 'En desarrollo, ejecuta primero Docs/limpiar_transacciones.sql.';
    END IF;
END;
$$;

DELETE FROM products;

COMMIT;

SELECT COUNT(*) AS remaining_products
FROM products;
