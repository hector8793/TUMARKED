# ADR 001: Arquitectura hexagonal inicial

- Estado: Aceptada
- Fecha: 2026-07-26

## Contexto

La aplicación necesita separar la lógica de negocio de NestJS, PostgreSQL y los proveedores externos para facilitar pruebas, mantenimiento y sustitución de infraestructura.

## Decisión

El backend se organiza en cuatro áreas:

- `presentation`: controladores HTTP y DTO.
- `application`: casos de uso y servicios de aplicación.
- `domain`: entidades y contratos.
- `infrastructure`: persistencia y adaptadores externos.

Los productos y la pasarela se consumen mediante puertos inyectables. Las operaciones transaccionales que requieren consultas SQL coordinadas pueden usar `DataSource` durante el MVP.

## Consecuencias

- Los controladores permanecen delgados.
- La integración externa puede reemplazarse mediante otro adaptador.
- Los puertos facilitan pruebas unitarias con dobles de prueba.
- El acceso directo a `DataSource` en algunos casos de uso representa deuda técnica controlada.
- Una evolución futura puede introducir repositorios para transacciones, eventos y checkout.
