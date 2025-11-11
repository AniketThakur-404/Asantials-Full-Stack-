// src/pages/CartPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useCart } from '../contexts/cart-context';
import {
  cartCreate,
  fetchProductByHandle,
  formatMoney,
  toProductCard,
  findVariantForSize,
  getProductImageUrl,
} from '../lib/shopify';
import { useCatalog } from '../contexts/catalog-context';

const CartPage = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem } = useCart();
  const { products: catalogProducts, getProduct } = useCatalog();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
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
      const fetchedProducts = {};
      const failures = [];

      for (const handle of missingHandles) {
        try {
          const product = await fetchProductByHandle(handle);
          if (product) {
            fetchedProducts[handle] = product;
          } else {
            failures.push(handle);
          }
        } catch (error) {
          console.error(`Failed to load Shopify product "${handle}"`, error);
          failures.push(handle);
        }
      }

      if (cancelled) return;

      if (Object.keys(fetchedProducts).length) {
        setExternalProducts((prev) => ({ ...prev, ...fetchedProducts }));
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

  const monetisedItems = readyItems;

  const subtotalAmount = monetisedItems.reduce(
    (acc, item) => acc + (item.lineTotal?.amount ?? 0),
    0,
  );
  const subtotalCurrency = monetisedItems[0]?.lineTotal?.currency;
  const deliveryAmount = monetisedItems.length > 0 ? 0 : 0;
  const totalAmount = subtotalAmount + deliveryAmount;

  const subtotalLabel = formatMoney(subtotalAmount, subtotalCurrency);
  const deliveryLabel =
    deliveryAmount === 0
      ? 'Complimentary'
      : formatMoney(deliveryAmount, subtotalCurrency);
  const totalLabel = formatMoney(totalAmount, subtotalCurrency);

  const isEmpty = items.length === 0;

  const recommendedProducts = useMemo(() => {
    if (!catalogProducts?.length) return [];
    const handlesInCart = new Set(items.map((item) => item.slug));
    return catalogProducts
      .filter((product) => !handlesInCart.has(product.handle))
      .map(toProductCard)
      .filter(Boolean)
      .slice(0, 4);
  }, [catalogProducts, items]);

  const resolveVariantId = (product, size) =>
    findVariantForSize(product, size)?.id ?? null;

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
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-neutral-200 pb-4">
        <h1 className="text-2xl font-semibold uppercase tracking-[0.3em] text-neutral-900">
          Shopping Cart
        </h1>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-dashed border-neutral-200 px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-600">
            Your cart is currently empty
          </p>
          <Link
            to="/"
            className="rounded-full border border-neutral-900 px-6 py-3 text-[11px] uppercase tracking-[0.32em] transition hover:bg-neutral-900 hover:text-white"
          >
            Explore Latest Drop
          </Link>
        </div>
      ) : (
        <div className="gap-12 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-6">
            {cartItems
              .filter((item) => !item.loading && item.product)
              .map((item) => {
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
                  <div
                    key={item.id}
                    className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 rounded-2xl border border-neutral-200 p-4 sm:gap-6"
                  >
                    <Link
                      to={`/product/${item.handle}`}
                      className="relative block overflow-hidden rounded-xl bg-neutral-100"
                    >
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
                    </Link>

                    <div className="flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            to={`/product/${item.handle}`}
                            className="text-sm font-semibold uppercase tracking-[0.25em] text-neutral-900 transition hover:underline"
                          >
                            {item.product.title}
                          </Link>
                          {item.size && (
                            <span className="rounded-full border border-neutral-200 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-neutral-600">
                              Size {item.size}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.25em] text-neutral-500">
                          <div className="flex items-center rounded-full border border-neutral-200">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              className="px-3 py-1 text-neutral-500 transition hover:text-neutral-900"
                              onClick={() =>
                                updateQuantity(
                                  item.handle,
                                  item.size ?? null,
                                  item.quantity - 1,
                                )
                              }
                            >
                              -
                            </button>
                            <span className="px-3 py-1 text-neutral-900">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              className="px-3 py-1 text-neutral-500 transition hover:text-neutral-900"
                              onClick={() =>
                                updateQuantity(
                                  item.handle,
                                  item.size ?? null,
                                  item.quantity + 1,
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            className="text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline"
                            onClick={() => removeItem(item.handle, item.size ?? null)}
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-sm font-medium tracking-[0.2em] text-neutral-900">
                          {unitPriceLabel}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em]">
                        <button
                          type="button"
                          className="text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline"
                          onClick={() =>
                            navigate(`/product/${item.handle}`, {
                              state: { focusSize: item.size },
                            })
                          }
                        >
                          Edit Selection
                        </button>
                        <span className="font-semibold text-neutral-900">{lineTotalLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <aside className="mt-10 space-y-6 rounded-3xl border border-neutral-200 p-6 lg:mt-0">
            <h2 className="text-sm uppercase tracking-[0.32em] text-neutral-600">
              Order Summary
            </h2>

            <dl className="space-y-3 text-sm tracking-[0.2em] text-neutral-600">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="text-neutral-900">{subtotalLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd className="text-neutral-900">{deliveryLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-neutral-900">Total</dt>
                <dd className="font-semibold text-neutral-900">{totalLabel}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={isCheckingOut || readyItems.length === 0}
              className="w-full rounded-full bg-neutral-900 py-4 text-[11px] uppercase tracking-[0.35em] text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-600 disabled:hover:bg-neutral-600"
            >
              {isCheckingOut ? 'Redirecting…' : 'Proceed to Checkout'}
            </button>

            {checkoutError && (
              <p className="rounded-2xl border border-red-400 bg-red-50 px-4 py-3 text-xs leading-relaxed tracking-[0.2em] text-red-700">
                {checkoutError}
              </p>
            )}

            <p className="text-xs leading-relaxed tracking-[0.25em] text-neutral-500">
              Duties and taxes are calculated at checkout. Free exchanges within India within 30 days
              of dispatch.
            </p>
          </aside>
        </div>
      )}

      {recommendedProducts.length > 0 && (
        <section className="mt-24">
          <div className="border-t border-neutral-200 py-4">
            <h2 className="text-[11px] uppercase tracking-[0.35em] text-neutral-600">
              Recommended for You
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommendedProducts.map((item) => (
              <ProductCard key={item.href} item={item} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
};

export default CartPage;
