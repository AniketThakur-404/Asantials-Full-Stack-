// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import ProductDetails from './pages/ProductDetails';
import CartPage from './pages/CartPage';
import SearchPage from './pages/SearchPage';
import AllProductsPage from './pages/AllProductsPage';

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<AllProductsPage />} />
          <Route path="shoes" element={<AllProductsPage initialCategory="shoes" />} />
          <Route path="shoes/loafers" element={<AllProductsPage initialCategory="loafers" />} />
          <Route path="shoes/boots" element={<AllProductsPage initialCategory="boots" />} />
          <Route path="shoes/sneakers" element={<AllProductsPage initialCategory="sneakers" />} />
          <Route path="shoes/sandals" element={<AllProductsPage initialCategory="sandals" />} />
          <Route path="apparel" element={<Navigate to="/products?category=t-shirts" replace />} />
          <Route path="product/:slug" element={<ProductDetails />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="product" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
