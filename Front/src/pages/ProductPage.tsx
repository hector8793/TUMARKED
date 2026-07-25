import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchProducts } from '../features/products/productsSlice';
import { formatCop } from '../utils/money';
import { CheckoutModal } from '../components/CheckoutModal';
import type { Product } from '../models/product';
import { Link } from 'react-router-dom';

export function ProductPage() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((state) => state.products);
  const [quantity, setQuantity] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => { void dispatch(fetchProducts()); }, [dispatch]);

  return (
    <>
      <header className="hero">
        <nav><span className="brand">TU<span>MARKED</span></span><Link className="nav-button light" to="/pedidos">Ver pedidos</Link></nav>
        <div><p className="eyebrow">TECNOLOGÍA PARA TU DÍA</p><h1>Encuentra eso que<br />te hace avanzar.</h1>
          <p>Productos seleccionados, pagos protegidos y entrega nacional.</p></div>
      </header>
      <main>
        <div className="section-title"><div><p className="eyebrow">CATÁLOGO</p><h2>Productos destacados</h2></div><span>{items.length} productos</span></div>
        {status === 'loading' && <p role="status">Cargando productos…</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <section className="products">
          {items.map((product) => {
            const amount = quantity[product.id] ?? 1;
            const unavailable = !product.active || product.stock === 0;
            return <article className="product-card" key={product.id}>
              <div className="image-wrap">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>TM</span>}
                <span className={`stock ${unavailable ? 'out' : ''}`}>{unavailable ? 'Agotado' : `${product.stock} disponibles`}</span></div>
              <div className="card-body"><small>{product.sku}</small><h3>{product.name}</h3><p>{product.description}</p>
                <strong>{formatCop(product.priceInCents)}</strong>
                <div className="buy-row"><label><span className="sr-only">Cantidad</span><select value={amount} disabled={unavailable}
                  onChange={(event) => setQuantity({ ...quantity, [product.id]: Number(event.target.value) })}>
                  {Array.from({ length: Math.min(product.stock, 10) }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
                </select></label><button disabled={unavailable} onClick={() => setSelected(product)}>Pagar con tarjeta</button></div>
              </div>
            </article>;
          })}
        </section>
      </main>
      <footer><span className="brand">TU<span>MARKED</span></span><p>Pagos procesados de forma segura · Valores en COP</p></footer>
      {selected && <CheckoutModal product={selected} quantity={quantity[selected.id] ?? 1} onClose={() => setSelected(null)} />}
    </>
  );
}
