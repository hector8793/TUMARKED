# ADR 003: Idempotencia y concurrencia de pagos

- Estado: Aceptada parcialmente
- Fecha: 2026-07-26

## Contexto

Los usuarios, navegadores y redes pueden repetir solicitudes. Dos peticiones simultáneas no deben generar dos cobros ni procesar dos veces un evento.

## Decisión

- El inicio del pago cambia atómicamente la transacción de `PENDING` a `PROCESSING`.
- Solo una petición puede completar ese cambio.
- Si ya existe un identificador externo, el backend consulta y concilia la transacción en lugar de crear otro pago.
- Los eventos externos generan un identificador determinista y se insertan con una restricción única.
- El inventario tiene una restricción única por transacción, producto y tipo de movimiento.

La tabla `idempotency_keys` queda preparada para una siguiente fase en la que `POST /checkouts` y `POST /transactions/:id/pay` acepten formalmente el encabezado `Idempotency-Key`.

## Consecuencias

- Se reducen cobros, eventos y descuentos de inventario duplicados.
- Las respuestas concurrentes pueden devolver un conflicto controlado.
- Todavía debe implementarse la reutilización formal de respuestas por `Idempotency-Key`.
- Las transacciones interrumpidas en `PROCESSING` requieren una estrategia de recuperación y conciliación.
