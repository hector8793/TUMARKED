# TUMARKED — Resumen funcional y técnico

## 1. Descripción

TUMARKED es una aplicación web de ventas enfocada en un flujo de compra sencillo: consultar productos, seleccionar una cantidad, registrar los datos del cliente y la entrega, revisar el resumen y crear un pedido.

La aplicación se desarrolla con enfoque **mobile-first**, usando azul como color principal, blanco para superficies y amarillo para etiquetas y elementos destacados.

Este documento resume la especificación contenida en `app_v2_parte_1.md` a `app_v2_parte_6.md`, el modelo de `tumarked_schema.sql` y el estado real de la implementación.

## 2. Alcance actual

La versión actual permite:

- Consultar productos activos desde PostgreSQL.
- Mostrar precio, descripción, disponibilidad y stock.
- Seleccionar una cantidad válida.
- Abrir un formulario de compra en tres pasos.
- Registrar datos del cliente y dirección de entrega.
- Capturar datos de tarjeta con máscaras y validaciones visuales.
- Mostrar el resumen calculado de la compra.
- Crear un pedido local con estado `PENDING`.
- Consultar los pedidos recientes y su estado.
- Enmascarar información personal en la lista de pedidos.

No incluye login, registro, carrito con varios productos ni panel administrativo. Esas funciones quedaron fuera del MVP definido en la especificación v2.

## 3. Estado de la integración con Wompi

Las variables para Wompi Sandbox están preparadas, pero la API de Wompi **todavía no procesa los pagos**.

Actualmente:

```text
Formulario
→ validación local
→ creación de cliente y entrega
→ creación de transacción PENDING
→ almacenamiento en PostgreSQL
```

Pendiente:

```text
Tarjeta
→ tokenización directa en Wompi Sandbox
→ envío del token al backend
→ firma de integridad
→ creación del pago en Wompi
→ webhook o consulta de estado
→ APPROVED / DECLINED / ERROR
→ descuento de stock si queda APPROVED
```

Los datos de tarjeta capturados actualmente no se guardan en Redux, `localStorage`, el backend ni PostgreSQL. Se eliminan del formulario después de crear el checkout.

## 4. Arquitectura

El proyecto está separado en dos aplicaciones:

```text
TUMARKED/
├── Front/                  React, Vite, TypeScript y SCSS
├── Back/                   NestJS, TypeORM y PostgreSQL
├── .github/workflows/      Integración y despliegue
├── tumarked_schema.sql     Esquema reproducible de PostgreSQL
└── DOCUMENTACION_TUMARKED.md
```

Cada aplicación tiene su propio `package.json`, `package-lock.json`, `node_modules` y `.gitignore`.

### Flujo general

```text
Navegador
   ↓
React + Redux
   ↓ HTTP / JSON
Controladores NestJS
   ↓
Casos de uso
   ↓
Puertos y adaptadores / TypeORM
   ↓
Amazon RDS PostgreSQL
```

### Frontend

Tecnologías principales:

- React 19.
- Vite.
- TypeScript estricto.
- Redux Toolkit.
- React Router.
- SCSS.
- Jest y React Testing Library.

Rutas disponibles:

| Ruta | Función |
|---|---|
| `/` | Catálogo y checkout |
| `/pedidos` | Historial de pedidos |

El consumo del backend se centraliza en `Front/src/services/api.ts`. Las validaciones reutilizables se encuentran en `Front/src/validators`.

### Backend

Tecnologías principales:

- NestJS.
- TypeScript.
- TypeORM.
- PostgreSQL.
- Swagger/OpenAPI.
- Helmet.
- Jest.

La estructura sigue una arquitectura hexagonal inicial:

```text
presentation/      Controladores HTTP y DTO
application/       Casos de uso
domain/            Entidades y puertos
infrastructure/    Persistencia y adaptadores TypeORM
```

Los controladores delegan el trabajo a casos de uso. La sincronización automática de TypeORM está desactivada; el esquema se administra con SQL.

## 5. API disponible

Prefijo general:

```text
/api/v1
```

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del backend |
| `GET` | `/products` | Lista productos activos |
| `GET` | `/products/:id` | Consulta un producto |
| `GET` | `/products/:id/stock` | Consulta el stock actual |
| `POST` | `/checkouts` | Crea cliente, entrega y transacción pendiente |
| `GET` | `/transactions` | Lista los pedidos recientes |

Swagger está disponible en:

```text
http://localhost:3000/swagger
```

## 6. Base de datos

La base de datos utiliza PostgreSQL en Amazon RDS. Los valores monetarios se almacenan como enteros en centavos para evitar errores de precisión.

Ejemplo:

```text
159.900 COP = 15.990.000 centavos
```

### Tablas principales

| Tabla | Responsabilidad |
|---|---|
| `products` | Catálogo, precio, stock y disponibilidad |
| `customers` | Datos básicos del comprador |
| `deliveries` | Dirección y estado de entrega |
| `transactions` | Estado y valores históricos del pedido |
| `transaction_items` | Productos incluidos en la transacción |
| `payment_events` | Eventos de Wompi e idempotencia del webhook |
| `transaction_status_history` | Historial de cambios de estado |
| `stock_movements` | Auditoría de movimientos de inventario |
| `idempotency_keys` | Protección frente a solicitudes repetidas |

### Estados

Transacciones:

```text
CREATED, PENDING, PROCESSING, APPROVED,
DECLINED, VOIDED, ERROR, CANCELLED
```

Entregas:

```text
PENDING, CONFIRMED, PREPARING,
SHIPPED, DELIVERED, CANCELLED
```

### Inventario

`tumarked_schema.sql` incluye la función `apply_approved_sale_stock`. Esta bloquea el producto, verifica existencias, descuenta el stock y registra el movimiento dentro de una transacción SQL.

La restricción única de `stock_movements` evita descontar dos veces el inventario para la misma transacción. Esta función está preparada, pero todavía debe conectarse al resultado aprobado de Wompi.

## 7. Seguridad

Medidas incorporadas:

- Variables sensibles en archivos `.env` ignorados por Git.
- Solo la llave pública de Wompi puede utilizarse en el frontend.
- Validación y limpieza de DTO mediante `ValidationPipe`.
- Campos no declarados rechazados por el backend.
- Cabeceras de seguridad mediante Helmet.
- CORS restringido al origen configurado.
- Conexión SSL con PostgreSQL configurable.
- Datos personales enmascarados en el listado público de pedidos.
- TypeORM con `synchronize: false`.

En producción se debe utilizar la CA oficial de Amazon RDS y guardar credenciales en AWS Secrets Manager.

## 8. Ejecución local

Requiere Node.js 20 o superior.

Instalación:

```powershell
npm.cmd install --prefix Front
npm.cmd install --prefix Back
```

Backend:

```powershell
npm.cmd run dev:back
```

Frontend:

```powershell
npm.cmd run dev:front
```

Direcciones locales:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3000/api/v1
Swagger:  http://localhost:3000/swagger
```

## 9. Variables de entorno

Los ejemplos se encuentran en:

```text
Front/.env.example
Back/.env.example
```

Los archivos `.env` reales nunca deben subirse al repositorio. El usuario y la contraseña del portal web de Wompi tampoco forman parte de las variables de ejecución de la aplicación.

## 10. Pruebas y construcción

Comandos disponibles:

```powershell
npm.cmd run build:front
npm.cmd run build:back
npm.cmd run test:front
npm.cmd run test:back
```

Existen pruebas iniciales para formato monetario, algoritmo de Luhn, detección de franquicia y casos de uso. La cobertura global todavía no alcanza el objetivo final del 80 % y debe ampliarse junto con la integración de pagos.

## 11. Automatización

La raíz contiene workflows de GitHub Actions para:

- Compilar y ejecutar pruebas.
- Construir y publicar el backend en Amazon ECR.
- Construir y publicar el frontend en S3 y actualizar CloudFront.

El pipeline del backend publica en ECR las etiquetas correspondientes al SHA del commit y `latest`.

## 12. Próximos pasos prioritarios

1. Tokenizar la tarjeta directamente con Wompi Sandbox.
2. Crear el endpoint de procesamiento de pago.
3. Generar y validar la firma de integridad.
4. Implementar el webhook firmado e idempotente.
5. Actualizar el estado definitivo del pedido.
6. Aplicar el descuento de stock únicamente en `APPROVED`.
7. Confirmar la entrega después de la aprobación.
8. Recuperar el progreso no sensible después de recargar.
9. Completar pruebas hasta superar el 80 %.
10. Terminar infraestructura AWS y despliegue.

## 13. Aclaración final

La pantalla de pedidos refleja las transacciones locales almacenadas en PostgreSQL. Un pedido `PENDING` confirma que el checkout fue creado, pero no representa todavía un pago aprobado por Wompi.
