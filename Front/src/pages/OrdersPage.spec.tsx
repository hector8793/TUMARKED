import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../services/api';
import { OrdersPage } from './OrdersPage';

jest.mock('../services/api', () => ({
  api: { listOrders: jest.fn() },
}));

const order = {
  id: 'transaction-1',
  reference: 'TM-001',
  status: 'APPROVED' as const,
  totalInCents: 1800000,
  currency: 'COP' as const,
  createdAt: '2026-07-26T12:00:00.000Z',
  customerName: 'A*** P***',
  city: 'Bogotá',
  products: [{ name: 'Audífonos', quantity: 2 }],
};

describe('OrdersPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads, renders and refreshes recent orders', async () => {
    jest.mocked(api.listOrders).mockResolvedValue([order]);
    render(<MemoryRouter><OrdersPage /></MemoryRouter>);

    expect(screen.getByRole('status')).toHaveTextContent('Consultando pedidos');
    expect(await screen.findByText('TM-001')).toBeVisible();
    expect(screen.getByText('Aprobado')).toBeVisible();
    expect(screen.getByText('Audífonos')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(api.listOrders).toHaveBeenCalledTimes(2));
  });

  it('shows an empty state', async () => {
    jest.mocked(api.listOrders).mockResolvedValue([]);
    render(<MemoryRouter><OrdersPage /></MemoryRouter>);

    expect(await screen.findByText('Aún no hay pedidos')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver productos' })).toHaveAttribute('href', '/');
  });

  it('shows a readable API error', async () => {
    jest.mocked(api.listOrders).mockRejectedValue(new Error('network'));
    render(<MemoryRouter><OrdersPage /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible consultar los pedidos',
    );
  });
});
