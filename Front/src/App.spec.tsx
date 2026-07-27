import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

jest.mock('./pages/ProductPage', () => ({
  ProductPage: () => <h1>Catálogo</h1>,
}));

jest.mock('./pages/OrdersPage', () => ({
  OrdersPage: () => <h1>Pedidos</h1>,
}));

describe('App routing', () => {
  it('renders the catalog, orders and redirects unknown routes', () => {
    const catalog = render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Catálogo' })).toBeVisible();
    catalog.unmount();

    const orders = render(
      <MemoryRouter initialEntries={['/pedidos']}><App /></MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
    orders.unmount();

    render(<MemoryRouter initialEntries={['/missing']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Catálogo' })).toBeVisible();
  });
});
