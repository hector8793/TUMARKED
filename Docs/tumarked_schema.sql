BEGIN;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUM TYPES
-- =========================================================
DO $$
BEGIN
    CREATE TYPE transaction_status AS ENUM (
        'CREATED',
        'PENDING',
        'PROCESSING',
        'APPROVED',
        'DECLINED',
        'VOIDED',
        'ERROR',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE delivery_status AS ENUM (
        'PENDING',
        'CONFIRMED',
        'PREPARING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE stock_movement_type AS ENUM (
        'SEED',
        'SALE',
        'RESTOCK',
        'ADJUSTMENT',
        'CANCELLATION'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- COMMON updated_at TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- PRODUCTS
-- Monetary values are stored as integer cents.
-- Example: COP 100,000 = 10,000,000 cents.
-- =========================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    price_in_cents BIGINT NOT NULL CHECK (price_in_cents >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- CUSTOMERS
-- No card information is stored here.
-- =========================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_customers_email_basic
        CHECK (position('@' IN email) > 1)
);

CREATE INDEX IF NOT EXISTS idx_customers_email_lower
    ON customers (LOWER(email));

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- DELIVERIES
-- Delivery is created during checkout and confirmed only on approval.
-- =========================================================
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(120) NOT NULL,
    department VARCHAR(120) NOT NULL,
    postal_code VARCHAR(20),
    instructions VARCHAR(500),
    status delivery_status NOT NULL DEFAULT 'PENDING',
    confirmed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON deliveries;
CREATE TRIGGER trg_deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- TRANSACTIONS
-- Holds the local payment transaction and provider references.
-- =========================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(80) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    delivery_id UUID NOT NULL UNIQUE REFERENCES deliveries(id) ON DELETE RESTRICT,

    status transaction_status NOT NULL DEFAULT 'CREATED',
    currency CHAR(3) NOT NULL DEFAULT 'COP' CHECK (currency = UPPER(currency)),

    subtotal_in_cents BIGINT NOT NULL CHECK (subtotal_in_cents >= 0),
    base_fee_in_cents BIGINT NOT NULL DEFAULT 0 CHECK (base_fee_in_cents >= 0),
    delivery_fee_in_cents BIGINT NOT NULL DEFAULT 0 CHECK (delivery_fee_in_cents >= 0),
    total_in_cents BIGINT NOT NULL CHECK (total_in_cents >= 0),

    provider_transaction_id VARCHAR(160) UNIQUE,
    provider_status VARCHAR(60),
    payment_method_type VARCHAR(40),
    installments SMALLINT CHECK (installments IS NULL OR installments > 0),
    failure_code VARCHAR(100),
    failure_reason VARCHAR(500),

    stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

    approved_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_transaction_total
        CHECK (total_in_cents = subtotal_in_cents + base_fee_in_cents + delivery_fee_in_cents)
);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_status ON transactions(provider_status);

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- TRANSACTION ITEMS
-- Supports the current one-product checkout and future multi-product use.
-- Product data is snapshotted to preserve purchase history.
-- =========================================================
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_sku VARCHAR(80) NOT NULL,
    product_name VARCHAR(160) NOT NULL,
    unit_price_in_cents BIGINT NOT NULL CHECK (unit_price_in_cents >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total_in_cents BIGINT NOT NULL CHECK (line_total_in_cents >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_transaction_product UNIQUE (transaction_id, product_id),
    CONSTRAINT chk_transaction_item_total
        CHECK (line_total_in_cents = unit_price_in_cents * quantity)
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
    ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id
    ON transaction_items(product_id);

-- =========================================================
-- PAYMENT EVENTS / WEBHOOK IDEMPOTENCY
-- Raw payload is JSONB for traceability. Never store card data.
-- =========================================================
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_event_id VARCHAR(180) NOT NULL UNIQUE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    provider_transaction_id VARCHAR(160),
    event_type VARCHAR(100) NOT NULL,
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL,
    processing_error VARCHAR(1000),
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_transaction_id
    ON payment_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_processed
    ON payment_events(processed, received_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_transaction_id
    ON payment_events(provider_transaction_id);

-- =========================================================
-- TRANSACTION STATUS HISTORY
-- Audit trail for local/provider status changes.
-- =========================================================
CREATE TABLE IF NOT EXISTS transaction_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    previous_status transaction_status,
    new_status transaction_status NOT NULL,
    source VARCHAR(40) NOT NULL CHECK (source IN ('API', 'PAYMENT_PROVIDER', 'WEBHOOK', 'SYSTEM')),
    reason VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_status_history_transaction
    ON transaction_status_history(transaction_id, created_at DESC);

-- =========================================================
-- STOCK MOVEMENTS
-- Guarantees auditability and prevents the same transaction from
-- deducting inventory more than once.
-- =========================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
    movement_type stock_movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity <> 0),
    stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
    stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
    reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_stock_movement_math
        CHECK (stock_after = stock_before + quantity)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_sale_per_transaction_product
    ON stock_movements(transaction_id, product_id, movement_type)
    WHERE transaction_id IS NOT NULL AND movement_type = 'SALE';

CREATE INDEX IF NOT EXISTS idx_stock_movements_product
    ON stock_movements(product_id, created_at DESC);

-- =========================================================
-- IDEMPOTENCY KEYS
-- Protects POST checkout/payment operations from client retries.
-- =========================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(180) NOT NULL UNIQUE,
    operation VARCHAR(80) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    response_status SMALLINT,
    response_body JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
    ON idempotency_keys(expires_at);

-- =========================================================
-- SAFE STOCK DEDUCTION FUNCTION
-- Execute inside the same DB transaction that approves the payment.
-- Returns the stock movement id. Repeated calls for the same transaction
-- and product return the existing movement without deducting twice.
-- =========================================================
CREATE OR REPLACE FUNCTION apply_approved_sale_stock(
    p_transaction_id UUID,
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_existing_id UUID;
    v_stock_before INTEGER;
    v_stock_after INTEGER;
    v_movement_id UUID;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    SELECT id
      INTO v_existing_id
      FROM stock_movements
     WHERE transaction_id = p_transaction_id
       AND product_id = p_product_id
       AND movement_type = 'SALE';

    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    SELECT stock
      INTO v_stock_before
      FROM products
     WHERE id = p_product_id
       AND active = TRUE
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % does not exist or is inactive', p_product_id;
    END IF;

    IF v_stock_before < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
    END IF;

    v_stock_after := v_stock_before - p_quantity;

    UPDATE products
       SET stock = v_stock_after,
           version = version + 1,
           updated_at = NOW()
     WHERE id = p_product_id;

    INSERT INTO stock_movements (
        product_id,
        transaction_id,
        movement_type,
        quantity,
        stock_before,
        stock_after,
        reason
    ) VALUES (
        p_product_id,
        p_transaction_id,
        'SALE',
        -p_quantity,
        v_stock_before,
        v_stock_after,
        'Approved payment'
    )
    RETURNING id INTO v_movement_id;

    UPDATE transactions
       SET stock_applied = TRUE,
           updated_at = NOW()
     WHERE id = p_transaction_id;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =========================================================
-- SEED DATA
-- Replace image URLs as needed.
-- The INSERT is repeatable because sku is unique.
-- =========================================================
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
        'TMK-001',
        'Audífonos inalámbricos',
        'Audífonos Bluetooth con estuche de carga y micrófono integrado.',
        15990000,
        25,
        'https://example.com/images/headphones.webp',
        TRUE
    ),
    (
        'TMK-002',
        'Reloj inteligente',
        'Reloj inteligente con monitoreo de actividad y notificaciones.',
        24990000,
        15,
        'https://example.com/images/smartwatch.webp',
        TRUE
    ),
    (
        'TMK-003',
        'Parlante portátil',
        'Parlante portátil resistente a salpicaduras y con conexión Bluetooth.',
        12990000,
        20,
        'https://example.com/images/speaker.webp',
        TRUE
    )
ON CONFLICT (sku) DO NOTHING;
