// src/components/Layout.jsx
import React, { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CatalogProvider from '../contexts/catalog-context';
import CartProvider from '../contexts/cart-context';
import NotificationProvider from './NotificationProvider';
import SearchOverlay from './SearchOverlay';
import CartDrawer from './CartDrawer';

const marqueeItems = [
  'ASANTIALS',
  'NEW ARRIVALS WEEKLY',
  'EXPRESS SHIPPING',
  'MEMBERS ONLY DROPS',
  'LIMITED EDITION RELEASES',
];

const TopAnnouncement = () => (
  <div
    className="relative h-6 w-full overflow-hidden bg-neutral-900 text-white"
    role="marquee"
    aria-label="Site announcements vertical marquee"
  >
    <div className="marquee-vertical group h-full text-[10px] uppercase tracking-[0.35em]">
      <div className="marquee-vertical__group">
        {marqueeItems.map((item, idx) => (
          <span className="marquee-vertical__item" key={item || idx}>
            {item}
          </span>
        ))}
      </div>

      <div aria-hidden className="marquee-vertical__group">
        {marqueeItems.map((item, idx) => (
          <span className="marquee-vertical__item" key={`${item || idx}-duplicate`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  </div>
);

const Layout = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const outletContext = useMemo(
    () => ({
      openCartDrawer: () => setCartOpen(true),
      closeCartDrawer: () => setCartOpen(false),
    }),
    [],
  );

  return (
    <CatalogProvider>
      <CartProvider>
        <NotificationProvider>
          <div className="bg-white text-neutral-900 min-h-screen flex flex-col">
            <div className="sticky top-0 z-50">
              <TopAnnouncement />
              <Navbar
                onSearchClick={() => setSearchOpen(true)}
                onCartClick={() => setCartOpen(true)}
              />
            </div>

            <main className="flex-grow">
              <Outlet context={outletContext} />
            </main>

            <Footer />

            <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
          </div>
        </NotificationProvider>
      </CartProvider>
    </CatalogProvider>
  );
};

export default Layout;
