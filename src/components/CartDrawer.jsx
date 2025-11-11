// src/components/CartDrawer.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useCart } from '../contexts/cart-context';
import { useCatalog } from '../contexts/catalog-context';
import {
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

  const subtotalAmount = readyItems.reduce(
    (acc, item) => acc + (item.lineTotal?.amount ?? 0),
    0,
  );
  const subtotalCurrency = readyItems[0]?.lineTotal?.currency;
  const subtotalLabel = formatMoney(subtotalAmount, subtotalCurrency);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const handleViewBag = () => {
    onClose();
    navigate('/cart');
  };

  const handleCheckout = () => {
    onClose();
    navigate('/cart');
  };

  return (
    <AnimatePresence>
      {open && (
        <Motion.div
          className="fixed inset-0 z-[998] flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Motion.div
            className="h-full w-full bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <Motion.aside
            className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-xs uppercase tracking-[0.35em] text-neutral-600">Your Cart</h2>
              <button
                type="button"
                onClick={onClose}
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
                  {readyItems.map((item) => {
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
                          <div className="h-24 w-24 overflow-hidden rounded-xl bg-neutral-100">
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
                          <div className="flex flex-1 flex-col justify-between text-xs uppercase tracking-[0.25em]">
                            <div>
                              <p className="text-neutral-900">{item.product.title}</p>
                              <p className="mt-1 text-neutral-500">{unitPriceLabel}</p>
                              {item.size && (
                                <p className="mt-1 text-neutral-500">Size {item.size}</p>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-neutral-600">
                              <div className="flex items-center rounded-full border border-neutral-200">
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
                            <div className="mt-2 text-neutral-900">{lineTotalLabel}</div>
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
                  disabled={readyItems.length === 0}
                  className="w-full rounded-full bg-neutral-900 py-3 text-[11px] uppercase tracking-[0.35em] text-white transition duration-200 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Checkout
                </button>
                <button
                  type="button"
                  onClick={handleViewBag}
                  className="w-full rounded-full border border-neutral-900 py-3 text-[11px] uppercase tracking-[0.35em] text-neutral-900 transition duration-200 hover:bg-neutral-900 hover:text-white active:scale-95"
                >
                  View Full Cart
                </button>
              </div>
            </footer>
          </Motion.aside>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;

