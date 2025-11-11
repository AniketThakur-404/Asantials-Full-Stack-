// src/components/Navbar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/cart-context';

const Navbar = ({ onSearchClick = () => {}, onCartClick = () => {} }) => {
  const [scrolled, setScrolled] = useState(false);
  const { totalItems } = useCart();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeCategory = searchParams.get('category');
  const isProductsPath = location.pathname === '/products';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItem =
    'px-2 uppercase tracking-[0.25em] text-[11px] transition-colors duration-200';

  return (
    <header
      className={`font-header border-t-2 border-black border-b border-neutral-200 ${
        scrolled ? 'bg-neutral-100' : 'bg-neutral-100'
      }`}
    >
      <div className="mx-auto h-14 w-full max-w-[1600px] px-4 sm:px-6 md:px-8 lg:px-2">
        <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center">
          {/* Left: Nav */}
          <nav className="hidden items-center gap-16 justify-self-start md:flex md:justify-start">
            <Link
              to="/products?category=t-shirts"
              className={`${navItem} ${
                isProductsPath && activeCategory === 't-shirts'
                  ? 'text-neutral-900 font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              T-SHIRTS
            </Link>
            <Link
              to="/products?category=hoodies"
              className={`${navItem} ${
                isProductsPath && activeCategory === 'hoodies'
                  ? 'text-neutral-900 font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              HOODIES
            </Link>
            <Link
              to="/products?category=shoes"
              className={`${navItem} ${
                isProductsPath && activeCategory === 'shoes'
                  ? 'text-neutral-900 font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              SHOES
            </Link>
          </nav>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Link
              to="/"
              className="font-extrabold tracking-[0.55em] text-[13px] leading-none text-neutral-900"
            >
              ASANTIALS
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-16">
            <button
              type="button"
              onClick={onSearchClick}
              className="hidden sm:block uppercase tracking-[0.25em] text-[11px] text-neutral-700 hover:text-neutral-900"
            >
              SEARCH
            </button>
            <Link
              to="/login"
              className="hidden sm:block uppercase tracking-[0.25em] text-[11px] text-neutral-700 hover:text-neutral-900"
            >
              LOGIN
            </Link>
            <button
              type="button"
              onClick={onCartClick}
              aria-label="Cart"
              className="relative flex items-center gap-2 uppercase tracking-[0.25em] text-[11px] text-neutral-700 transition hover:text-neutral-900"
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={1.5} />
              {totalItems > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
                  {totalItems}
                </span>
              )}
              <span className="hidden sm:inline">CART</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
