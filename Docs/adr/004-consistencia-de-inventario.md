# ADR 004: Consistencia del inventario

- Estado: Aceptada
- Fecha: 2026-07-26

## Contexto

El inventario solo debe descontarse después de un pago aprobado. Una consulta repetida o un webhook duplicado no puede reducir nuevamente el stock.

## Decisión

La aprobación se aplica dentro de una transacción PostgreSQL. La función `apply_approved_sale_stock`:

1. Bloquea el producto.
2. Comprueba si el movimiento ya existe.
3. Valida las existencias.
4. Actualiza el stock.
5. Registra el movimiento.
6. Marca la transacción con `stock_applied`.

Una restricción única protege la combinación de transacción, producto y movimiento de venta.

## Consecuencias

- El pago y el inventario conservan una trazabilidad auditable.
- Los eventos repetidos no descuentan dos veces.
- La concurrencia se resuelve mediante bloqueos y restricciones de PostgreSQL.
- Una aprobación sin stock suficiente genera un error que debe quedar visible para conciliación operativa.
