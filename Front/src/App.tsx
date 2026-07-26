import { Navigate, Route, Routes } from "react-router-dom";
import { ProductPage } from "./pages/ProductPage";
import { OrdersPage } from "./pages/OrdersPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ProductPage />} />
      <Route path="/pedidos" element={<OrdersPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
