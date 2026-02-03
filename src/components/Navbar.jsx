// src/components/Navbar.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, Search, ShoppingCart, X } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { useCart } from '../contexts/cart-context';

const categoryAliases = {
  hoodies: 'jeans',
};

const normalizeCategory = (value) =>
  value ? categoryAliases[value] ?? value : value;

const Navbar = ({ onSearchClick = () => {}, onCartClick = () => {} }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopDropdown, setDesktopDropdown] = useState(null);
  const [mobileDropdown, setMobileDropdown] = useState(null);
  const closeTimeoutRef = useRef(null);
  const { totalItems } = useCart();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlCategory = normalizeCategory(searchParams.get('category'));
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const pathCategory = pathSegments[0] === 'shoes' ? pathSegments[1] ?? 'shoes' : null;
  const activeCategory = urlCategory ?? pathCategory ?? null;
  const isProductsPath =
    location.pathname === '/products' || location.pathname.startsWith('/shoes');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const openDesktopDropdown = (value) => {
    clearCloseTimeout();
    setDesktopDropdown(value);
  };

  const closeDesktopDropdown = (delay = 150) => {
    clearCloseTimeout();
    if (!delay) {
      setDesktopDropdown(null);
      return;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setDesktopDropdown(null);
      closeTimeoutRef.current = null;
    }, delay);
  };

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileDropdown(null);
    clearCloseTimeout();
    setDesktopDropdown(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
    };
  }, [mobileMenuOpen]);

  const shoeDropdownLinks = [
    { href: '/shoes/loafers', value: 'loafers', label: 'LOAFERS' },
    { href: '/shoes/boots', value: 'boots', label: 'BOOTS' },
    { href: '/shoes/sneakers', value: 'sneakers', label: 'SNEAKERS' },
    { href: '/shoes/sandals', value: 'sandals', label: 'SANDALS' },
  ];

  const navLinks = [
    { href: '/products?category=t-shirts', value: 't-shirts', label: 'T-SHIRTS' },
    { href: '/products?category=jeans', value: 'jeans', label: 'JEANS' },
    { href: '/shoes', value: 'shoes', label: 'SHOES', children: shoeDropdownLinks },
  ];

  const navItem =
    'relative flex items-center gap-1 px-2 tracking-[0.25em] text-[11px] font-semibold transition-colors duration-200 before:absolute before:-left-1 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-neutral-900 before:opacity-0 before:content-[""] before:transition-opacity before:duration-200 after:absolute after:-bottom-1 after:left-0 after:h-[1px] after:w-full after:bg-neutral-900 after:opacity-0 after:content-[""] after:transition-transform after:duration-200 after:origin-left after:scale-x-0';

  const renderNavLink = (link) => {
    const childActive = link.children?.some((child) => child.value === activeCategory);
    const isActive = isProductsPath && (activeCategory === link.value || childActive);

    if (link.children?.length) {
      const isOpen = desktopDropdown === link.value;
      return (
        <div
          key={link.value}
          className="relative"
          onMouseEnter={() => openDesktopDropdown(link.value)}
          onMouseLeave={() => closeDesktopDropdown()}
          onFocusCapture={() => openDesktopDropdown(link.value)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              closeDesktopDropdown();
            }
          }}
        >
          <Link
            to={link.href}
            className={`${navItem} ${
              isActive
                ? 'font-semibold text-neutral-900 before:opacity-100'
                : 'text-neutral-600 hover:text-neutral-900 hover:after:opacity-60 hover:after:scale-x-100'
            }`}
            aria-haspopup="true"
            aria-expanded={isOpen}
          >
            {link.label}
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </Link>

          <div
            className={`absolute left-1/2 top-full mt-3 w-48 -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white py-3 text-[10px] uppercase tracking-[0.32em] text-neutral-600 font-semibold shadow-[0_25px_50px_-40px_rgba(0,0,0,0.55)] transition-all duration-200 ${
              isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {link.children.map((child) => (
              <Link
                key={child.value}
                to={child.href}
                className={`group flex flex-col px-4 py-2 transition ${
                  activeCategory === child.value ? 'text-neutral-900' : 'hover:text-neutral-900'
                }`}
              >
                <span>{child.label}</span>
                <span
                  className={`mt-1 h-[1px] w-full bg-neutral-900 transition-transform duration-200 ${
                    activeCategory === child.value ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`}
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </div>
      );
    }

    return (
      <Link
        key={link.value}
        to={link.href}
        className={`${navItem} ${
          isActive
            ? 'font-semibold text-neutral-900 before:opacity-100'
            : 'text-neutral-600 hover:text-neutral-900 hover:after:opacity-60 hover:after:scale-x-100'
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
      <div className="site-shell h-[64px] w-full sm:h-[72px] md:h-[82px]">
        <div className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          {/* Left: Nav */}
          <div className="flex w-24 items-center gap-3 justify-self-start sm:w-auto lg:gap-6">
            <button
              type="button"
              className={`relative flex items-center gap-2 rounded-full border border-neutral-900 px-3 py-1 text-[10px] tracking-[0.32em] text-neutral-900 transition lg:hidden ${
                mobileMenuOpen ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900 hover:text-white'
              }`}
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

            <nav className="hidden items-center gap-8 justify-self-start lg:flex lg:justify-start xl:gap-16">
              {navLinks.map(renderNavLink)}
            </nav>
          </div>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Link to="/" className="block">
              <img
                src="/images/evrydae-logo-transparent.png"
                alt="EVRYDAE"
                className="block h-[70px] w-auto object-contain sm:h-[78px] md:h-[90px]"
              />
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex w-24 items-center justify-end gap-3 sm:w-auto sm:gap-10 lg:gap-14 xl:gap-16">
            <button
              type="button"
              onClick={onSearchClick}
              className="sm:hidden flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
              aria-label="Search"
            >
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </button>
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
              className="relative flex h-9 w-9 items-center justify-center gap-0 rounded-full border border-neutral-300 uppercase tracking-[0.25em] text-[11px] text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 sm:h-auto sm:w-auto sm:justify-start sm:gap-2 sm:rounded-none sm:border-0"
            >
              <ShoppingCart className="h-5 w-5 sm:h-4 sm:w-4" strokeWidth={1.5} />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white sm:static sm:translate-x-0 sm:translate-y-0">
                  {totalItems}
                </span>
              )}
              <span className="hidden sm:inline">CART</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
        <Motion.div
          id="primary-navigation"
          className={`fixed inset-0 z-40 lg:hidden ${
            mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          initial={false}
          animate={{ opacity: mobileMenuOpen ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
        <Motion.button
          type="button"
          aria-hidden
          onClick={() => setMobileMenuOpen(false)}
          className="absolute inset-0 bg-black/40"
          initial={false}
          animate={{ opacity: mobileMenuOpen ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
        <Motion.nav
          className="absolute left-0 top-0 flex h-full w-full max-w-none flex-col gap-0 bg-white px-5 pb-8 pt-6 shadow-2xl"
          initial={false}
          animate={{ x: mobileMenuOpen ? 0 : '-100%' }}
          transition={{ type: 'tween', duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-0 flex items-center justify-between border-b border-neutral-200 pb-4 text-[11px] uppercase tracking-[0.32em] text-neutral-500">
            <span>Menu</span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-full border border-transparent p-2 text-neutral-700 transition hover:border-neutral-200 hover:text-neutral-900"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onSearchClick();
              setMobileMenuOpen(false);
            }}
            className="flex items-center justify-between border-b border-neutral-200 px-1 py-4 text-[11px] uppercase tracking-[0.3em] text-neutral-700 transition hover:text-neutral-900"
          >
            Search
            <span aria-hidden>⌕</span>
          </button>
          {navLinks.map((link) => {
            const childActive = link.children?.some((child) => child.value === activeCategory);
            const isActive = isProductsPath && (activeCategory === link.value || childActive);
            const isDropdownOpen = mobileDropdown === link.value;

            return (
              <div key={`mobile-${link.value}`} className="border-b border-neutral-200 py-4">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex-1 text-[12px] font-semibold uppercase tracking-[0.28em] transition ${
                      isActive ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                  {link.children?.length ? (
                    <button
                      type="button"
                      onClick={() =>
                        setMobileDropdown((prev) => (prev === link.value ? null : link.value))
                      }
                      aria-expanded={isDropdownOpen}
                      className="rounded-full border border-neutral-300 p-2 text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900"
                    >
                      <ChevronDown
                        className={`h-3 w-3 transition ${isDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  ) : null}
                </div>

                {link.children?.length ? (
                  <div
                    className={`ml-3 mt-2 space-y-2 border-l border-neutral-200 pl-3 text-[11px] uppercase tracking-[0.26em] font-semibold transition-all duration-200 ${
                      isDropdownOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    {link.children.map((child) => (
                      <Link
                        key={`mobile-${child.value}`}
                        to={child.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block py-1 text-neutral-500 transition ${
                          activeCategory === child.value ? 'text-neutral-900' : 'hover:text-neutral-900'
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </Motion.nav>
      </Motion.div>
    </header>
  );
};

export default Navbar;
