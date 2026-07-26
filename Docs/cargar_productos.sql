-- =========================================================
-- TUMARKED - CATÁLOGO DE PRODUCTOS
-- =========================================================
-- Las imágenes se publican desde Front/assets mediante Vite.
-- Las rutas comienzan con "/" para funcionar tanto localmente
-- como en el sitio web de Amazon S3.
--
-- El script es repetible: si un SKU existe, actualiza el producto.
-- Los valores monetarios se expresan en centavos de peso colombiano.
-- =========================================================

BEGIN;

INSERT INTO products (
    sku,
    name,
    description,
    price_in_cents,
    stock,
    image_url,
    active
)
VALUES
    (
        'TMK-AUD-001',
        'Audífonos inalámbricos',
        'Audífonos de diadema para música, llamadas y trabajo diario.',
        18990000,
        24,
        '/headphones.webp',
        TRUE
    ),
    (
        'TMK-WAT-001',
        'Reloj inteligente',
        'Reloj inteligente con seguimiento de actividad y notificaciones.',
        25990000,
        18,
        '/smartwatch.webp',
        TRUE
    ),
    (
        'TMK-PWB-001',
        'Batería portátil',
        'Batería externa compacta para cargar dispositivos fuera de casa.',
        11990000,
        32,
        '/powerbank.webp',
        TRUE
    ),
    (
        'TMK-MOU-001',
        'Mouse inalámbrico',
        'Mouse ergonómico e inalámbrico para estudio, oficina y hogar.',
        8990000,
        30,
        '/mouse.webp',
        TRUE
    ),
    (
        'TMK-LAM-001',
        'Lámpara de escritorio',
        'Lámpara moderna para crear un espacio de trabajo cómodo e iluminado.',
        13990000,
        16,
        '/lamp.jpg',
        TRUE
    ),
    (
        'TMK-KEY-001',
        'Teclado inalámbrico',
        'Teclado compacto para una escritura cómoda y un escritorio ordenado.',
        16990000,
        20,
        '/keyboard.webp',
        TRUE
    ),
    (
        'TMK-HUB-001',
        'Hub multipuerto USB',
        'Adaptador multipuerto para ampliar la conectividad del computador.',
        12990000,
        27,
        '/hub.webp',
        TRUE
    ),
    (
        'TMK-WEB-001',
        'Cámara web',
        'Cámara web para videollamadas, reuniones y clases virtuales.',
        17990000,
        14,
        '/webcam.jpg',
        TRUE
    ),
    (
        'TMK-CHA-001',
        'Silla de oficina',
        'Silla ergonómica diseñada para brindar comodidad durante la jornada.',
        64990000,
        8,
        '/chair.webp',
        TRUE
    ),
    (
        'TMK-BOT-001',
        'Botella térmica',
        'Botella reutilizable para conservar bebidas durante las actividades diarias.',
        7990000,
        35,
        '/bottle.webp',
        TRUE
    )
ON CONFLICT (sku) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_in_cents = EXCLUDED.price_in_cents,
    stock = EXCLUDED.stock,
    image_url = EXCLUDED.image_url,
    active = EXCLUDED.active,
    updated_at = NOW();

COMMIT;

SELECT
    sku,
    name,
    price_in_cents,
    stock,
    image_url,
    active
FROM products
ORDER BY name;
