import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Order } from '../services/api';
import { formatCop } from '../utils/money';

const statusLabels: Record<Order['status'], string> = {
  CREATED: 'Creado',
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  APPROVED: 'Aprobado',
  DECLINED: 'Rechazado',
  VOIDED: 'Anulado',
  ERROR: 'Error',
  CANCELLED: 'Cancelado',
};

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await api.listOrders());
    } catch {
      setError('No fue posible consultar los pedidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return <>
    <header className="orders-header">
      <nav><Link className="brand brand-link" to="/">TU<span>MARKED</span></Link><Link className="nav-button light" to="/">Volver a productos</Link></nav>
      <div><p className="eyebrow">SEGUIMIENTO</p><h1>Mis pedidos</h1><p>Consulta las compras creadas y su estado actual.</p></div>
    </header>
    <main className="orders-main">
      <div className="section-title"><div><p className="eyebrow">HISTORIAL</p><h2>Pedidos recientes</h2></div>
        <button className="refresh" onClick={() => void load()} disabled={loading}>Actualizar</button></div>
      {loading && <p role="status">Consultando pedidos…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && orders.length === 0 && <div className="empty-orders"><strong>Aún no hay pedidos</strong><p>Crea tu primera compra desde el catálogo.</p><Link className="nav-button" to="/">Ver productos</Link></div>}
      <section className="orders-list">
        {orders.map((order) => <article className="order-card" key={order.id}>
          <div className="order-top"><div><small>REFERENCIA</small><h3>{order.reference}</h3></div>
            <span className={`status status-${order.status.toLowerCase()}`}>{statusLabels[order.status]}</span></div>
          <div className="order-products">{order.products.map((product, index) =>
            <p key={`${product.name}-${index}`}><span>{product.name}</span><strong>× {product.quantity}</strong></p>)}</div>
          <div className="order-meta"><span>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</span>
            <span>{order.customerName} · {order.city}</span></div>
          <div className="order-total"><span>Total</span><strong>{formatCop(order.totalInCents)}</strong></div>
        </article>)}
      </section>
    </main>
  </>;
}
