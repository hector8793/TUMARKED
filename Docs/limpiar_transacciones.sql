-- =========================================================
-- TUMARKED - LIMPIEZA DE TRANSACCIONES
-- =========================================================
-- Elimina todas las transacciones y sus datos dependientes.
-- Conserva productos y clientes.
-- Restaura el inventario descontado por transacciones aprobadas.
--
-- ADVERTENCIA: esta operación es destructiva y no se puede deshacer
-- después del COMMIT. Se recomienda usarla únicamente en desarrollo.
-- =========================================================

BEGIN;

CREATE TEMP TABLE transactions_to_delete
ON COMMIT DROP
AS
SELECT id, delivery_id, provider_transaction_id
FROM transactions;

-- Revierte en productos los movimientos de inventario asociados.
WITH stock_to_restore AS (
    SELECT
        sm.product_id,
        SUM(sm.quantity) AS net_quantity
    FROM stock_movements sm
    JOIN transactions_to_delete target
      ON target.id = sm.transaction_id
    GROUP BY sm.product_id
)
UPDATE products product
SET
    stock = product.stock - stock_to_restore.net_quantity,
    version = product.version + 1,
    updated_at = NOW()
FROM stock_to_restore
WHERE product.id = stock_to_restore.product_id;

-- Estas referencias no usan borrado en cascada o restringen la
-- eliminación de la transacción, por eso se limpian explícitamente.
DELETE FROM payment_events event
USING transactions_to_delete target
WHERE event.transaction_id = target.id
   OR (
       target.provider_transaction_id IS NOT NULL
       AND event.provider_transaction_id = target.provider_transaction_id
   );

DELETE FROM idempotency_keys key
USING transactions_to_delete target
WHERE key.transaction_id = target.id;

DELETE FROM stock_movements movement
USING transactions_to_delete target
WHERE movement.transaction_id = target.id;

-- transaction_items y transaction_status_history se eliminan mediante
-- ON DELETE CASCADE.
DELETE FROM transactions;

-- Cada checkout crea una entrega exclusiva para su transacción.
DELETE FROM deliveries delivery
USING transactions_to_delete target
WHERE delivery.id = target.delivery_id;

COMMIT;

-- Verificación: las cinco cantidades deberían quedar en cero.
SELECT 'transactions' AS table_name, COUNT(*) AS remaining_rows FROM transactions
UNION ALL
SELECT 'transaction_items', COUNT(*) FROM transaction_items
UNION ALL
SELECT 'transaction_status_history', COUNT(*) FROM transaction_status_history
UNION ALL
SELECT 'stock_movements_with_transaction', COUNT(*) FROM stock_movements WHERE transaction_id IS NOT NULL
UNION ALL
SELECT 'payment_events_with_transaction', COUNT(*) FROM payment_events WHERE transaction_id IS NOT NULL;
