import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { Product } from '../../models/product';
import { api } from '../../services/api';

interface ProductsState {
  items: Product[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ProductsState = { items: [], status: 'idle', error: null };

export const fetchProducts = createAsyncThunk('products/fetch', api.listProducts);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state) => {
        state.status = 'failed';
        state.error = 'No fue posible cargar los productos.';
      });
  },
});

export default productsSlice.reducer;

