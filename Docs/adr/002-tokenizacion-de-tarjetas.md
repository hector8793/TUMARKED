# ADR 002: Tokenización directa de tarjetas

- Estado: Aceptada
- Fecha: 2026-07-26

## Contexto

Procesar o almacenar números de tarjeta y CVC en TUMARKED aumentaría el riesgo de seguridad y el alcance de cumplimiento.

## Decisión

El frontend envía los datos de tarjeta directamente a la pasarela de pagos. La pasarela devuelve un token temporal y únicamente ese token se entrega al backend.

TUMARKED no guarda el número de tarjeta ni el CVC en Redux, `localStorage`, logs, solicitudes al backend o PostgreSQL. Los campos sensibles se limpian después del intento de pago.

## Consecuencias

- Se reduce la exposición de datos sensibles.
- El frontend solo utiliza una llave pública.
- Las llaves privadas permanecen en el backend.
- Un token vencido o consumido requiere tokenizar nuevamente la tarjeta.
- Los errores de tokenización se presentan sin registrar la información sensible.
