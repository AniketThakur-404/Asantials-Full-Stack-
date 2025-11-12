// src/components/Navbar.jsx
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, ShoppingCart, X } from 'lucide-react';
import { useCart } from '../contexts/cart-context';

const Navbar = ({ onSearchClick = () => {}, onCartClick = () => {} }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const navLinks = [
    { href: '/products?category=t-shirts', value: 't-shirts', label: 'T-SHIRTS' },
    { href: '/products?category=hoodies', value: 'hoodies', label: 'HOODIES' },
    { href: '/products?category=shoes', value: 'shoes', label: 'SHOES' },
  ];

  const navItem = 'px-2 tracking-[0.25em] text-[11px] transition-colors duration-200';

  const renderNavLink = (link) => {
    const isActive = isProductsPath && activeCategory === link.value;
    return (
      <Link
        key={link.value}
        to={link.href}
        className={`${navItem} ${
          isActive ? 'font-semibold text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'
        }`}
      >
        {link.label}
      </Link>
    );
  };

  return (
    <header
      className={`font-header border-t-2 border-black border-b border-neutral-200 ${
        scrolled ? 'bg-neutral-100' : 'bg-neutral-100'
      }`}
    >
      <div className="site-shell h-14 w-full">
        <div className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          {/* Left: Nav */}
          <div className="flex items-center gap-3 justify-self-start md:gap-6">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-neutral-900 px-3 py-1 text-[10px] tracking-[0.32em] text-neutral-900 transition hover:bg-neutral-900 hover:text-white md:hidden"
              aria-controls="primary-navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? (
                <X aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Menu aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              )}
              Menu
            </button>

            <nav className="hidden items-center gap-10 justify-self-start md:flex md:justify-start lg:gap-16">
              {navLinks.map(renderNavLink)}
            </nav>
          </div>

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

      <div
        id="primary-navigation"
        className={`border-t border-neutral-200 transition-[grid-template-rows,opacity] duration-300 md:hidden ${
          mobileMenuOpen ? 'grid grid-rows-[1fr] opacity-100' : 'grid grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <nav className="site-shell flex flex-col gap-4 py-4 text-[11px] tracking-[0.3em] text-neutral-600">
            {navLinks.map((link) => (
              <Link
                key={`mobile-${link.value}`}
                to={link.href}
                className={`border-b border-neutral-200 pb-3 transition ${
                  isProductsPath && activeCategory === link.value
                    ? 'text-neutral-900'
                    : 'hover:text-neutral-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
