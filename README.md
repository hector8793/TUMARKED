# TUMARKED

Aplicación web de ventas con catálogo, checkout, procesamiento de pagos, seguimiento de pedidos y control de inventario.

## Acceso a producción

| Servicio | URL |
|---|---|
| Repositorio público | [https://github.com/hector8793/TUMARKED](https://github.com/hector8793/TUMARKED) |
| Aplicación web | [http://tumarked.s3-website.us-east-2.amazonaws.com/](http://tumarked.s3-website.us-east-2.amazonaws.com/) |
| API | [http://tumarked-alb-1877790968.us-east-2.elb.amazonaws.com](http://tumarked-alb-1877790968.us-east-2.elb.amazonaws.com) |
| Health check | [http://tumarked-alb-1877790968.us-east-2.elb.amazonaws.com/api/v1/health](http://tumarked-alb-1877790968.us-east-2.elb.amazonaws.com/api/v1/health) |
| Swagger | [http://tumarked-alb-1877790968.us-east-2.elb.amazonaws.com/swagger](http://tumarked-alb-1877790968.us-east-2.elb.amazonaws.com/swagger) |

> El ambiente publicado utiliza HTTP. Para un entorno productivo definitivo se recomienda habilitar HTTPS en el frontend y en el Application Load Balancer.

## Descripción y alcance

TUMARKED permite consultar productos, seleccionar una cantidad, registrar los datos del comprador y la entrega, pagar con tarjeta y consultar el estado del pedido.

La versión actual incluye:

- Catálogo de productos activos con precio, descripción y stock.
- Interfaz adaptable para escritorio, tableta y celular.
- Checkout guiado en tres pasos.
- Validación y formato de datos personales, dirección y tarjeta.
- Tokenización directa de la tarjeta mediante una pasarela de pagos.
- Creación, firma y procesamiento del pago desde el backend.
- Estados `PENDING`, `PROCESSING`, `APPROVED`, `DECLINED` y `ERROR`.
- Consulta y conciliación del estado de las transacciones.
- Recepción idempotente de eventos firmados.
- Confirmación de la entrega y descuento único del inventario al aprobarse el pago.
- Historial de pedidos con datos personales enmascarados.

El MVP no incluye autenticación de usuarios, carrito con varios productos ni panel administrativo.

## Arquitectura

### Infraestructura AWS

```text
GitHub
   │
   └── GitHub Actions
          ├── Frontend ──> Amazon S3 (sitio web estático)
          │
          └── Backend ──> Docker ──> Amazon ECR
                                      │
                                      └── Amazon ECS Fargate
                                                 │
                                                 ▼
                                      Application Load Balancer
                                                 │
                              ┌──────────────────┴──────────────────┐
                              ▼                                     ▼
                   Amazon RDS PostgreSQL                  AWS Secrets Manager
```

Componentes principales:

| Componente | Responsabilidad |
|---|---|
| Amazon S3 | Hospedaje del frontend estático |
| Application Load Balancer | Punto de entrada público para la API |
| Amazon ECS Fargate | Ejecución del contenedor del backend |
| Amazon ECR | Almacenamiento de imágenes Docker |
| Amazon RDS | Base de datos PostgreSQL administrada |
| AWS Secrets Manager | Gestión de configuración sensible |
| GitHub Actions | Integración, construcción y despliegue continuo |

### Arquitectura de la aplicación

```text
Navegador
   │
   ▼
React + Redux Toolkit
   │ HTTP / JSON
   ▼
Controladores NestJS
   │
   ▼
Casos de uso
   │
   ▼
Puertos y adaptadores
   ├── TypeORM ──> PostgreSQL
   └── Adaptador ──> Pasarela de pagos
```

El backend utiliza una arquitectura hexagonal inicial:

```text
presentation/      Controladores HTTP y DTO
application/       Casos de uso y servicios de aplicación
domain/            Contratos y puertos
infrastructure/    Persistencia y adaptadores externos
```

TypeORM tiene `synchronize: false`; el esquema se administra mediante SQL para evitar cambios automáticos en la base de datos.

### Estructura del repositorio

```text
TUMARKED/
├── Front/                  React, Vite, TypeScript y SCSS
├── Back/                   NestJS, TypeORM y PostgreSQL
├── Docs/
│   ├── tumarked_schema.sql
│   ├── limpiar_transacciones.sql
│   ├── borrar_productos.sql
│   ├── cargar_productos.sql
│   └── adr/
├── .github/workflows/      CI y despliegues
└── README.md
```

Front y Back tienen su propio `package.json`, `package-lock.json`, dependencias y configuración de entorno.

### Decisiones de arquitectura

Las decisiones relevantes y sus consecuencias están documentadas en:

- `Docs/adr/001-arquitectura-hexagonal.md`
- `Docs/adr/002-tokenizacion-de-tarjetas.md`
- `Docs/adr/003-idempotencia-de-pagos.md`
- `Docs/adr/004-consistencia-de-inventario.md`

## Flujo de compra y pago

```text
1. El usuario selecciona un producto y una cantidad.
2. El frontend valida los datos personales y de entrega.
3. La tarjeta se envía directamente a la pasarela para tokenización.
4. El backend crea cliente, entrega y transacción local PENDING.
5. El frontend envía al backend únicamente el token temporal.
6. El backend genera la firma de integridad y solicita el pago.
7. La transacción pasa a APPROVED, DECLINED, PENDING o ERROR.
8. El backend concilia cambios mediante consulta o webhook firmado.
9. Si queda APPROVED, confirma la entrega y descuenta el inventario.
10. El frontend muestra el resultado y permite consultar el pedido.
```

El inicio del pago utiliza una actualización atómica para evitar solicitudes simultáneas. Los eventos externos tienen control de idempotencia para impedir su procesamiento duplicado.

Los números de tarjeta y el CVC no se almacenan en Redux, `localStorage`, el backend ni PostgreSQL. Después del intento, los campos sensibles se eliminan del formulario.

El progreso recuperable se conserva temporalmente en `sessionStorage`: producto, cantidad, paso, datos del cliente, entrega y, cuando ya existe, el identificador de la transacción. Al refrescar, la aplicación reabre el checkout y consulta el estado en el backend. Nunca se persisten número de tarjeta, CVC, token de tarjeta ni tokens de aceptación.

## API

Prefijo general:

```text
/api/v1
```

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/health` | Verifica el estado del backend |
| `GET` | `/products` | Lista productos activos |
| `GET` | `/products/:id` | Consulta un producto |
| `GET` | `/products/:id/stock` | Consulta su stock actual |
| `POST` | `/checkouts` | Crea cliente, entrega y transacción pendiente |
| `GET` | `/transactions` | Lista pedidos recientes |
| `GET` | `/transactions/:id` | Consulta y concilia una transacción |
| `POST` | `/transactions/:id/pay` | Procesa un pago con token de tarjeta |
| `POST` | `/webhooks/payment-provider` | Recibe eventos firmados de la pasarela |

En desarrollo, Swagger está disponible en `http://localhost:3000/swagger`.

Swagger es la documentación principal de la API. Incluye ejemplos de solicitudes y respuestas, parámetros UUID, validaciones, códigos de error y el flujo servidor a servidor del webhook. Los tokens mostrados son ficticios y deben reemplazarse por tokens generados en el ambiente de pruebas.

## Frontend

Tecnologías:

- React 19.
- Vite.
- TypeScript estricto.
- Redux Toolkit.
- React Router.
- SCSS.
- Jest y React Testing Library.

### Arquitectura del frontend

El frontend está organizado por responsabilidad:

```text
src/
├── app/          Configuración de Redux, store y hooks tipados
├── components/   Componentes reutilizables y flujo de checkout
├── features/     Estado global dividido por funcionalidad
├── models/       Tipos del dominio consumidos por la interfaz
├── pages/        Pantallas asociadas a las rutas
├── services/     Acceso a la API y al proveedor de pagos
├── styles/       Paleta, componentes visuales y diseño adaptable
├── utils/        Funciones puras reutilizables
├── validators/   Reglas de validación independientes
└── test/         Configuración de pruebas
```

```text
Página o componente
      │
      ├── Redux Toolkit ──> estado global de productos
      ├── estado local ───> formulario y pasos del checkout
      ├── services/api ───> backend
      └── payment-provider ──> tokenización de tarjeta
```

Redux se utiliza para información compartida, mientras que los datos temporales del formulario permanecen en el componente. Esta separación evita guardar información sensible de tarjeta en el estado global.

Rutas:

| Ruta | Función |
|---|---|
| `/` | Catálogo y checkout |
| `/pedidos` | Historial de pedidos |

El consumo del backend se centraliza en `Front/src/services/api.ts`; la comunicación con el proveedor de pagos está aislada en `Front/src/services/payment-provider.ts`.

### Buenas prácticas del frontend

- TypeScript estricto y modelos tipados para productos, pedidos y respuestas HTTP.
- URLs y llaves públicas proporcionadas mediante variables de entorno.
- Acceso HTTP centralizado para evitar llamadas dispersas en los componentes.
- Integración de pagos aislada detrás de un servicio específico.
- Estado global limitado a información compartida; formularios manejados localmente.
- Validaciones y utilidades puras separadas de la presentación.
- Datos de tarjeta tokenizados sin almacenarlos en Redux o `localStorage`.
- Componentes con etiquetas semánticas, mensajes `role="alert"` y estados de foco visibles.
- SCSS basado en variables de color, espaciado consistente y diseño responsive.
- Pruebas unitarias para servicios, formato monetario y validación de tarjetas.

## Backend

Tecnologías:

- NestJS.
- TypeScript.
- TypeORM.
- PostgreSQL.
- Swagger/OpenAPI.
- Helmet.
- Jest.

### Arquitectura del backend

El backend aplica una arquitectura hexagonal inicial con inyección de dependencias:

```text
src/
├── presentation/
│   ├── controllers    Entrada HTTP y documentación Swagger
│   └── dto            Validación de solicitudes
├── application/
│   ├── use-cases      Reglas y coordinación de cada operación
│   └── services       Criptografía y actualización de estados
├── domain/
│   ├── entities       Modelos independientes
│   └── ports          Contratos de persistencia y pagos
└── infrastructure/
    ├── persistence    Entidades y repositorios TypeORM
    └── payment-provider
                       Adaptador de la pasarela de pagos
```

```text
Solicitud HTTP
     │
     ▼
Controller + DTO
     │
     ▼
Caso de uso
     │
     ├── Puerto de repositorio ──> Adaptador TypeORM
     ├── Puerto de pagos ────────> Adaptador externo
     └── DataSource ─────────────> Operaciones SQL transaccionales
```

Los controladores se limitan a recibir y validar solicitudes. Los casos de uso coordinan la lógica, y el proveedor de pagos se consume mediante un puerto para que pueda reemplazarse sin modificar la capa de aplicación.

La separación hexagonal está más desarrollada en productos y pagos. Algunas operaciones transaccionales todavía utilizan `DataSource` directamente desde la capa de aplicación; es una decisión práctica del MVP y un punto posible de refactorización hacia repositorios específicos.

### Buenas prácticas del backend

- DTO con `class-validator`, transformación de tipos y rechazo de campos desconocidos.
- Inyección de dependencias de NestJS y contratos mediante símbolos.
- Adaptador externo desacoplado de los casos de uso.
- Variables sensibles obtenidas desde `ConfigService`.
- TypeORM con `synchronize: false` y esquema SQL versionado.
- Operaciones críticas de aprobación e inventario dentro de transacciones de base de datos.
- Actualización atómica antes de iniciar un pago para reducir cobros simultáneos.
- Descuento idempotente de inventario mediante restricción única.
- Validación criptográfica de firmas de integridad y eventos.
- Registro y deduplicación de eventos externos.
- Normalización e historial de estados de transacción.
- Tarjetas representadas únicamente mediante tokens temporales.
- Helmet, configuración CORS explícita, prefijo versionado y documentación Swagger.
- Pruebas unitarias para criptografía y casos de uso.

## Base de datos

La aplicación utiliza PostgreSQL en Amazon RDS. Los importes monetarios se almacenan como enteros en centavos para evitar errores de precisión:

```text
159.900 COP = 15.990.000 centavos
```

El esquema reproducible está en `Docs/tumarked_schema.sql`.

### Relaciones principales

```text
customers
   ├── deliveries
   └── transactions
          ├── transaction_items ──> products
          ├── transaction_status_history
          ├── payment_events
          ├── stock_movements ──> products
          └── idempotency_keys
```

### Diccionario de datos

#### `products`

Catálogo y disponibilidad de productos.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `sku` | Código único del producto |
| `name` | Nombre del producto |
| `description` | Descripción comercial |
| `price_in_cents` | Precio en centavos |
| `stock` | Unidades disponibles |
| `image_url` | URL de la imagen |
| `active` | Disponibilidad en el catálogo |
| `version` | Versión para control de cambios |
| `created_at` | Fecha de creación |
| `updated_at` | Fecha de actualización |

#### `customers`

Datos básicos del comprador.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `first_name` | Nombre |
| `last_name` | Apellido |
| `email` | Correo electrónico |
| `phone` | Número de contacto |
| `created_at` | Fecha de creación |
| `updated_at` | Fecha de actualización |

#### `deliveries`

Dirección y seguimiento de la entrega.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `customer_id` | Cliente relacionado |
| `address` | Dirección de entrega |
| `city` | Ciudad |
| `department` | Departamento |
| `postal_code` | Código postal |
| `instructions` | Indicaciones adicionales |
| `status` | Estado de la entrega |
| `confirmed_at` | Fecha de confirmación |
| `shipped_at` | Fecha de envío |
| `delivered_at` | Fecha de entrega |
| `created_at` | Fecha de creación |
| `updated_at` | Fecha de actualización |

#### `transactions`

Información financiera y estado del pedido.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `reference` | Referencia única del pedido |
| `customer_id` | Cliente relacionado |
| `delivery_id` | Entrega asociada |
| `status` | Estado local |
| `currency` | Moneda |
| `subtotal_in_cents` | Subtotal en centavos |
| `base_fee_in_cents` | Tarifa base |
| `delivery_fee_in_cents` | Costo de entrega |
| `total_in_cents` | Total del pedido |
| `provider_transaction_id` | Identificador en la pasarela |
| `provider_status` | Estado informado por la pasarela |
| `payment_method_type` | Medio de pago |
| `installments` | Número de cuotas |
| `failure_code` | Código del error |
| `failure_reason` | Descripción del error |
| `stock_applied` | Indica si se descontó inventario |
| `delivery_confirmed` | Indica si se confirmó la entrega |
| `approved_at` | Fecha de aprobación |
| `declined_at` | Fecha de rechazo |
| `processed_at` | Fecha de procesamiento |
| `created_at` | Fecha de creación |
| `updated_at` | Fecha de actualización |

#### `transaction_items`

Detalle histórico de los productos comprados.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `transaction_id` | Transacción relacionada |
| `product_id` | Producto relacionado |
| `product_sku` | Copia histórica del SKU |
| `product_name` | Copia histórica del nombre |
| `unit_price_in_cents` | Precio unitario |
| `quantity` | Cantidad comprada |
| `line_total_in_cents` | Total de la línea |
| `created_at` | Fecha de creación |

#### `payment_events`

Eventos recibidos desde la pasarela y control de procesamiento.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `provider_event_id` | Identificador único del evento |
| `transaction_id` | Transacción local |
| `provider_transaction_id` | Identificador de la pasarela |
| `event_type` | Tipo de evento |
| `signature_valid` | Resultado de validar la firma |
| `payload` | Contenido JSON recibido |
| `processing_error` | Error de procesamiento |
| `processed` | Indica si fue procesado |
| `processed_at` | Fecha de procesamiento |
| `received_at` | Fecha de recepción |
| `created_at` | Fecha de creación |

#### `transaction_status_history`

Auditoría de los cambios de estado.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `transaction_id` | Transacción relacionada |
| `previous_status` | Estado anterior |
| `new_status` | Estado nuevo |
| `source` | Origen del cambio |
| `reason` | Motivo |
| `metadata` | Información adicional |
| `created_at` | Fecha de creación |

#### `stock_movements`

Auditoría de los cambios de inventario.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `product_id` | Producto relacionado |
| `transaction_id` | Transacción que originó el movimiento |
| `movement_type` | Tipo de movimiento |
| `quantity` | Variación del inventario |
| `stock_before` | Inventario anterior |
| `stock_after` | Inventario resultante |
| `reason` | Motivo |
| `created_at` | Fecha de creación |

#### `idempotency_keys`

Protección frente a solicitudes repetidas.

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `idempotency_key` | Clave única de idempotencia |
| `operation` | Operación protegida |
| `request_hash` | Hash de la solicitud |
| `transaction_id` | Transacción relacionada |
| `response_status` | Código HTTP almacenado |
| `response_body` | Respuesta almacenada |
| `expires_at` | Fecha de expiración |
| `created_at` | Fecha de creación |

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

### Inventario y limpieza de pruebas

La función `apply_approved_sale_stock` bloquea el producto, valida existencias, descuenta el stock y registra el movimiento dentro de una misma transacción SQL.

Una restricción única impide descontar dos veces el mismo producto para una transacción. El script `Docs/limpiar_transacciones.sql` elimina los datos transaccionales de desarrollo y restaura el inventario sin borrar productos ni clientes. No se ejecuta automáticamente.

## Seguridad

- Variables sensibles almacenadas fuera del repositorio.
- Solo la llave pública de pagos se expone al frontend.
- Tarjetas tokenizadas directamente con la pasarela.
- DTO validados y campos desconocidos rechazados mediante `ValidationPipe`.
- Cabeceras de seguridad mediante Helmet.
- Conexión SSL configurable con PostgreSQL.
- Información personal enmascarada en el listado de pedidos.
- TypeORM configurado con `synchronize: false`.
- Firmas de integridad para crear pagos.
- Verificación de firmas e idempotencia para eventos externos.

CORS permanece abierto temporalmente durante las pruebas de despliegue. Antes de cerrar producción debe restringirse al dominio del frontend mediante `FRONTEND_ORIGIN`.

También se recomienda instalar la CA oficial de Amazon RDS y mantener credenciales y secretos en AWS Secrets Manager.

## Ejecución local

Requiere Node.js 20 o superior.

### Instalación

```powershell
npm.cmd install --prefix Front
npm.cmd install --prefix Back
```

### Backend

```powershell
cd Back
npm.cmd run run
```

### Frontend

```powershell
cd Front
npm.cmd run run
```

Servicios locales:

| Servicio | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| API | `http://localhost:3000/api/v1` |
| Swagger | `http://localhost:3000/swagger` |

## Variables de entorno

Los ejemplos están en `Front/.env.example` y `Back/.env.example`. Los archivos `.env` reales están ignorados por Git.

Variables principales:

| Aplicación | Variable | Uso |
|---|---|---|
| Front | `VITE_API_URL` | URL pública del backend |
| Front | `VITE_PAYMENT_API_URL` | URL del proveedor de pagos |
| Front | `VITE_PAYMENT_PUBLIC_KEY` | Llave pública para tokenización |
| Back | `DATABASE_URL` | Conexión PostgreSQL |
| Back | `FRONTEND_ORIGIN` | Origen permitido por CORS |
| Back | `PAYMENT_API_URL` | URL del proveedor de pagos |
| Back | `PAYMENT_PRIVATE_KEY` | Llave privada |
| Back | `PAYMENT_EVENTS_SECRET` | Validación de eventos |
| Back | `PAYMENT_INTEGRITY_SECRET` | Firma de integridad |

Las credenciales del portal del proveedor no son variables de ejecución y nunca deben almacenarse en el repositorio.

## Pruebas y construcción

```powershell
cd Front
npm.cmd run build
npm.cmd run coverage

cd ..\Back
npm.cmd run build
npm.cmd run coverage
```

Las pruebas cubren componentes, páginas, Redux, recuperación del checkout, validaciones, cliente de pagos, controladores, persistencia, criptografía, webhooks y casos de uso.

Resultados actuales:

| Proyecto | Pruebas | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|---:|
| Front | 27 | 87.11 % | 82.72 % | 89.02 % | 89.58 % |
| Back | 34 | 98.37 % | 88.88 % | 96.55 % | 99.61 % |

Jest exige un mínimo global de 80 % en las cuatro métricas. Si una cobertura cae por debajo del umbral, el pipeline de integración continua falla.

## CI/CD

Los workflows de `.github/workflows` realizan:

### Integración continua

1. Instalan las dependencias de Front y Back.
2. Compilan ambas aplicaciones.
3. Ejecutan sus pruebas y reportes de cobertura.

### Despliegue del backend

1. Construyen la imagen Docker.
2. Publican las etiquetas del SHA y `latest` en Amazon ECR.
3. Fuerzan una nueva implementación en ECS Fargate.
4. Esperan que el servicio quede estable.

### Despliegue del frontend

1. Compilan Vite con las variables públicas configuradas en GitHub Secrets.
2. Sincronizan el contenido de `Front/dist` con el bucket de Amazon S3.

## Consideraciones pendientes

1. Habilitar HTTPS para el sitio y la API.
2. Restringir CORS al dominio definitivo del frontend.
3. Configurar la CA oficial de Amazon RDS.
4. Añadir observabilidad y alarmas para pagos y webhooks.
5. Incorporar recuperación controlada de transacciones interrumpidas en `PROCESSING`.

Un pedido `PENDING` confirma que el checkout fue creado, pero no representa un pago aprobado. El estado definitivo debe consultarse en el historial o mediante `GET /transactions/:id`.
