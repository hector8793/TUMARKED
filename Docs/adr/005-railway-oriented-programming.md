# ADR 005: Railway Oriented Programming progresivo

- Estado: Aceptada
- Fecha: 2026-07-27

## Contexto

Los casos de uso no deberían conocer códigos HTTP ni depender de excepciones de NestJS. Sin embargo, migrar simultáneamente todo el flujo de checkout y pagos aumentaría el riesgo sobre funcionalidad ya validada.

## Decisión

ROP se introduce progresivamente comenzando por `GetProductUseCase`.

El dominio define un resultado explícito:

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

El caso de uso devuelve una de las dos vías:

```ts
const product = await products.findById(id);

if (!product) {
  return failure({
    code: 'PRODUCT_NOT_FOUND',
    message: 'Producto no encontrado',
  });
}

return success(product);
```

La capa HTTP interpreta el resultado:

```ts
const result = await getProduct.execute(id);
return unwrapHttpResult(result);
```

`unwrapHttpResult` devuelve el valor exitoso o transforma el error de aplicación en la misma excepción HTTP utilizada previamente.

## Consecuencias

- El caso de uso deja de depender de `NotFoundException`.
- Los errores posibles quedan descritos mediante tipos.
- El contrato público conserva el mismo `404` y el código `PRODUCT_NOT_FOUND`.
- La migración puede continuar caso por caso sin alterar el checkout ni los pagos.
- Mientras la migración esté incompleta coexistirán resultados ROP y excepciones controladas.

## Siguiente evolución

El siguiente candidato sería `CreateCheckoutUseCase`, incorporando errores tipados para producto no disponible y stock insuficiente. El flujo de pagos debe migrarse únicamente después de mantener pruebas de regresión para concurrencia, compensación y conciliación.
