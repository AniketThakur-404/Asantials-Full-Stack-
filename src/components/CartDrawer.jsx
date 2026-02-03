// src/components/CartDrawer.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useCart } from '../contexts/cart-context';
import { useCatalog } from '../contexts/catalog-context';
import {
  cartCreate,
  fetchProductByHandle,
  findVariantForSize,
  formatMoney,
  getProductImageUrl,
} from '../lib/shopify';

const CartDrawer = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem } = useCart();
  const { getProduct } = useCatalog();
  const [externalProducts, setExternalProducts] = useState({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastFocusedRef = useRef(null);


  const cartHandles = useMemo(
    () => Array.from(new Set(items.map((item) => item.slug).filter(Boolean))),
    [items],
  );

  useEffect(() => {
    const missingHandles = cartHandles.filter(
      (handle) => !getProduct(handle) && !externalProducts[handle],
    );
    if (!missingHandles.length) return;

    let cancelled = false;


    (async () => {
      const fetched = {};
      const failures = [];
      for (const handle of missingHandles) {
        try {
          const product = await fetchProductByHandle(handle);
          if (product) {
            fetched[handle] = product;
          } else {
            failures.push(handle);
          }
        } catch (error) {
          console.error(`Failed to load Shopify product "${handle}"`, error);
          failures.push(handle);
        }
      }

      if (cancelled) return;
      if (Object.keys(fetched).length) {
        setExternalProducts((prev) => ({ ...prev, ...fetched }));
      }

      if (failures.length) {
        failures.forEach((handle) => {
          removeItem(handle);
        });
      }


    })();

    return () => {
      cancelled = true;
    };
  }, [cartHandles, getProduct, externalProducts, removeItem]);

  const cartItems = useMemo(
    () =>
      items.map((item) => {
        const handle = item.slug;
        const product = getProduct(handle) ?? externalProducts[handle];
        const quantity = item.quantity ?? 1;

        if (!product) {
          return {
            id: item.id,
            handle,
            quantity,
            size: item.size ?? null,
            loading: true,
          };
        }

        const variant = findVariantForSize(product, item.size);
        const unitPriceAmount = variant?.price ?? product.price ?? 0;
        const currencyCode = variant?.currencyCode ?? product.currencyCode;

        return {
          id: item.id,
          handle,
          product,
          variant,
          quantity,
          size: item.size ?? null,
          loading: false,
          unitPrice: {
            amount: unitPriceAmount,
            currency: currencyCode,
          },
          lineTotal: {
            amount: unitPriceAmount * quantity,
            currency: currencyCode,
          },
        };
      }),
    [items, getProduct, externalProducts],
  );

  const readyItems = useMemo(
    () => cartItems.filter((item) => !item.loading && item.product),
    [cartItems],
  );
  const displayItems = useMemo(() => [...readyItems].reverse(), [readyItems]);

  const subtotalAmount = readyItems.reduce(
    (acc, item) => acc + (item.lineTotal?.amount ?? 0),
    0,
  );
  const subtotalCurrency = readyItems[0]?.lineTotal?.currency;
  const subtotalLabel = formatMoney(subtotalAmount, subtotalCurrency);

  const resolveVariantId = (product, size) =>
    findVariantForSize(product, size)?.id ?? null;

  useEffect(() => {
    if (!open) return undefined;
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
  }, [open]);

  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement;
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
      return;
    }

    const drawer = drawerRef.current;
    if (drawer && drawer.contains(document.activeElement)) {
      const lastFocused = lastFocusedRef.current;
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      } else if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    }
  }, [open]);

  const handleViewBag = () => {
    onClose();
    navigate('/cart');
  };

  const handleCheckout = async () => {
    if (!items.length || isCheckingOut) return;

    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const productMap = new Map();

      cartItems.forEach((item) => {
        if (!item.loading && item.product) {
          productMap.set(item.handle, item.product);
        }
      });

      const handlesToFetch = cartHandles.filter((handle) => !productMap.has(handle));
      const fetchErrors = [];

      await Promise.all(
        handlesToFetch.map(async (handle) => {
          try {
            const product = await fetchProductByHandle(handle);
            if (product) {
              productMap.set(handle, product);
            } else {
              fetchErrors.push(handle);
            }
          } catch (error) {
            console.error(`Failed to fetch Shopify product "${handle}"`, error);
            fetchErrors.push(handle);
          }
        }),
      );

      if (fetchErrors.length) {
        setCheckoutError(
          `Some products are not available in Shopify (handles: ${fetchErrors.join(
            ', ',
          )}). Update the handles in your catalog or publish those products before checking out.`,
        );
        return;
      }

      const missingVariants = [];
      const lines = [];

      for (const lineItem of cartItems) {
        if (lineItem.loading || !lineItem.product) {
          missingVariants.push({ handle: lineItem.handle, reason: 'product' });
          continue;
        }

        const product = productMap.get(lineItem.handle);
        if (!product) {
          missingVariants.push({ handle: lineItem.handle, reason: 'product' });
          continue;
        }

        const merchandiseId = resolveVariantId(product, lineItem.size);
        if (!merchandiseId) {
          missingVariants.push({
            handle: lineItem.handle,
            size: lineItem.size ?? null,
            reason: 'variant',
          });
          continue;
        }

        const quantity = Number(lineItem.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity < 1) continue;

        lines.push({
          merchandiseId,
          quantity: Math.min(Math.floor(quantity), 99),
        });
      }

      if (missingVariants.length) {
        const messages = missingVariants.map((entry) =>
          entry.reason === 'product'
            ? `Product "${entry.handle}" is unavailable in Shopify.`
            : `Variant for "${entry.handle}" with size "${entry.size ?? 'default'}" was not found.`,
        );
        setCheckoutError(messages.join(' '));
        return;
      }

      if (!lines.length) {
        setCheckoutError(
          'Unable to prepare checkout for your items. Please refresh the page or contact support.',
        );
        return;
      }

      const cart = await cartCreate(lines);
      const checkoutUrl = cart?.checkoutUrl;

      if (!checkoutUrl) {
        setCheckoutError('Checkout link unavailable. Please try again in a moment.');
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      console.error('Shopify checkout failed', error);
      setCheckoutError(
        error instanceof Error && error.message
          ? error.message
          : 'We could not start the checkout. Please try again or reach out to support.',
      );
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <Motion.div
      className={`fixed inset-0 z-[998] overflow-hidden ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      inert={!open}
    >
      <Motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
      <Motion.aside
        ref={drawerRef}
        className="absolute right-0 top-0 flex h-full w-full max-w-none flex-col bg-white shadow-2xl sm:max-w-md"
        initial={false}
        animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.98 }}
        transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
      >
            <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-xs uppercase tracking-[0.35em] text-neutral-600">Your Cart</h2>
              <button
                type="button"
                onClick={onClose}
                ref={closeButtonRef}
                className="rounded-full border border-transparent p-2 transition hover:border-neutral-200"
                aria-label="Close cart"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {cartItems.length === 0 ? (
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                  Your cart is currently empty.
                </p>
              ) : (
                <div className="space-y-6">
                  {displayItems.map((item) => {
                      const imageUrl = getProductImageUrl(item.product);
                      const unitPriceLabel = formatMoney(
                        item.unitPrice.amount,
                        item.unitPrice.currency,
                      );
                      const lineTotalLabel = formatMoney(
                        item.lineTotal.amount,
                        item.lineTotal.currency,
                      );

                      return (
                        <div key={item.id} className="flex gap-4">
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={item.product.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.3em] text-neutral-400">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col gap-2 text-[11px] uppercase tracking-[0.25em]">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-neutral-900">{item.product.title}</p>
                              <span className="whitespace-nowrap text-neutral-900">
                                {lineTotalLabel}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-500">
                              <span>{unitPriceLabel}</span>
                              {item.size && <span>Size: {item.size}</span>}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-neutral-600">
                              <div className="flex items-center rounded-lg border border-neutral-300">
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  className="px-3 py-1 transition hover:text-neutral-900 active:scale-95"
                                  onClick={() =>
                                    updateQuantity(
                                      item.handle,
                                      item.size ?? null,
                                      item.quantity - 1,
                                    )
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="px-3 py-1 text-neutral-900">{item.quantity}</span>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  className="px-3 py-1 transition hover:text-neutral-900 active:scale-95"
                                  onClick={() =>
                                    updateQuantity(
                                      item.handle,
                                      item.size ?? null,
                                      item.quantity + 1,
                                    )
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <button
                                type="button"
                                aria-label="Remove item"
                                className="rounded-full border border-transparent p-2 transition hover:border-neutral-200 active:scale-95"
                                onClick={() => removeItem(item.handle, item.size ?? null)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <footer className="border-t border-neutral-200 px-6 py-6">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-neutral-600">
                <span>Subtotal</span>
                <span className="text-neutral-900">{subtotalLabel}</span>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-[0.32em] text-neutral-500">
                Taxes and shipping calculated at checkout.
              </p>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={readyItems.length === 0 || isCheckingOut}
                  className="w-full rounded-full bg-neutral-900 py-3 text-[11px] uppercase tracking-[0.35em] text-white transition duration-200 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isCheckingOut ? 'Redirecting…' : 'Checkout'}
                </button>
                <button
                  type="button"
                  onClick={handleViewBag}
                  className="w-full rounded-full border border-neutral-900 py-3 text-[11px] uppercase tracking-[0.35em] text-neutral-900 transition duration-200 hover:bg-neutral-900 hover:text-white active:scale-95"
                >
                  View Full Cart
                </button>
              </div>
              {checkoutError && (
                <p className="mt-4 rounded-2xl border border-red-400 bg-red-50 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-red-700">
                  {checkoutError}
                </p>
              )}
            </footer>
      </Motion.aside>
    </Motion.div>
  );
};

export default CartDrawer;

