INSERT INTO products (sku, name, description, price_in_cents, stock, image_url, active)
VALUES
  ('TMK-001', 'Audífonos inalámbricos', 'Bluetooth, estuche de carga y micrófono integrado.', 15990000, 25, NULL, TRUE),
  ('TMK-002', 'Reloj inteligente', 'Monitoreo de actividad y notificaciones.', 24990000, 15, NULL, TRUE),
  ('TMK-003', 'Parlante portátil', 'Resistente a salpicaduras con conexión Bluetooth.', 12990000, 20, NULL, TRUE)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_in_cents = EXCLUDED.price_in_cents,
  stock = EXCLUDED.stock,
  active = EXCLUDED.active;

