// src/components/SearchOverlay.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../contexts/catalog-context';
import { formatMoney, getProductImageUrl, searchProducts } from '../lib/shopify';

const normalizeSearchText = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const buildSearchableText = (product) => {
  const parts = [];
  const push = (value) => {
    if (value === null || value === undefined || value === '') return;
    parts.push(String(value));
  };

  push(product?.title);
  push(product?.handle);
  push(product?.vendor);
  push(product?.productType);
  push(product?.description);

  (product?.tags ?? []).forEach(push);
  (product?.options ?? []).forEach((option) => {
    push(option?.name);
    (option?.values ?? []).forEach(push);
  });
  (product?.variants ?? []).forEach((variant) => {
    push(variant?.title);
    push(variant?.sku);
    (variant?.selectedOptions ?? []).forEach((opt) => push(opt?.value));
  });
  (product?.collections ?? []).forEach((collection) => {
    push(collection?.title);
    push(collection?.handle);
  });

  return normalizeSearchText(parts.join(' '));
};

const buildSuggestions = (products, query, limit = 6) => {
  const candidates = [];
  (products ?? []).forEach((product) => {
    if (!product?.title) return;
    candidates.push({
      label: product.title,
      normalized: normalizeSearchText(product.title),
    });
  });

  const queryNormalized = normalizeSearchText(query);
  const tokens = queryNormalized ? queryNormalized.split(' ').filter(Boolean) : [];

  if (!queryNormalized) {
    const seen = new Set();
    const out = [];
    for (const item of candidates) {
      if (!item.normalized || seen.has(item.normalized)) continue;
      seen.add(item.normalized);
      out.push(item.label);
      if (out.length >= limit) break;
    }
    return out;
  }

  const scored = candidates
    .filter((item) => (tokens.length ? tokens.every((t) => item.normalized.includes(t)) : true))
    .map((item) => {
      const exact = queryNormalized && item.normalized === queryNormalized ? 1 : 0;
      const starts = queryNormalized && item.normalized.startsWith(queryNormalized) ? 1 : 0;
      const contains = queryNormalized && item.normalized.includes(queryNormalized) ? 1 : 0;
      return {
        ...item,
        score: exact * 100 + starts * 50 + contains * 20,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.label.length - b.label.length;
    });

  const seen = new Set();
  const out = [];
  for (const item of scored) {
    if (!item.normalized || seen.has(item.normalized)) continue;
    seen.add(item.normalized);
    out.push(item.label);
    if (out.length >= limit) break;
  }
  return out;
};

const recentSearchKey = 'evrydae-recent-searches-v1';
const readRecentSearches = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(recentSearchKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const SearchOverlay = ({ open, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const { products: catalogProducts } = useCatalog();
  const [recentSearches, setRecentSearches] = useState([]);

  const popularProducts = useMemo(
    () =>
      (catalogProducts ?? [])
        .slice(0, 6)
        .map((product) => ({
          title: product.title,
          price: formatMoney(product.price, product.currencyCode),
          img: getProductImageUrl(product),
          href: `/product/${product.handle}`,
          badge: product.tags?.includes('new') ? 'New' : undefined,
        }))
        .filter((card) => card.href),
    [catalogProducts],
  );

  const [productResults, setProductResults] = useState(popularProducts);
  const [loading, setLoading] = useState(false);

  const searchIndex = useMemo(
    () =>
      (catalogProducts ?? []).map((product) => ({
        product,
        haystack: buildSearchableText(product),
      })),
    [catalogProducts],
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setProductResults(popularProducts);
      setRecentSearches(readRecentSearches());

      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);

      const body = document.body;
      const html = document.documentElement;
      const previousBodyOverflow = body.style.overflow;
      const previousHtmlOverflow = html.style.overflow;
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';

      return () => {
        window.clearTimeout(timer);
        body.style.overflow = previousBodyOverflow;
        html.style.overflow = previousHtmlOverflow;
      };
    }

    return undefined;
  }, [open, popularProducts]);

  const persistRecentSearch = (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const normalized = normalizeSearchText(trimmed);
    setRecentSearches((prev) => {
      const next = [
        trimmed,
        ...prev.filter((item) => normalizeSearchText(item) !== normalized),
      ].slice(0, 8);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(recentSearchKey, JSON.stringify(next));
      }
      return next;
    });
  };

  const removeRecentSearch = (term) => {
    setRecentSearches((prev) => {
      const normalized = normalizeSearchText(term);
      const next = prev.filter((item) => normalizeSearchText(item) !== normalized);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(recentSearchKey, JSON.stringify(next));
      }
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(recentSearchKey, JSON.stringify([]));
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (!term) {
      setProductResults(popularProducts);
      setLoading(false);
      return;
    }
    const tokens = normalizeSearchText(term).split(' ').filter(Boolean);
    if (!tokens.length) {
      setProductResults([]);
      setLoading(false);
      return;
    }

    if (searchIndex.length) {
      const matches = searchIndex
        .filter(({ haystack }) => tokens.every((token) => haystack.includes(token)))
        .map(({ product }) => ({
          title: product.title,
          price: formatMoney(product.price, product.currencyCode),
          img: getProductImageUrl(product),
          href: `/product/${product.handle}`,
          badge: product.tags?.includes('new') ? 'New' : undefined,
        }))
        .filter((card) => card.href)
        .slice(0, 6);
      setProductResults(matches);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchProducts(term, 6)
      .then((nodes) => {
        if (cancelled) return;
        const cards =
          nodes?.map((node) => ({
            title: node?.title ?? 'Product',
            price: formatMoney(
              node?.priceRange?.minVariantPrice?.amount,
              node?.priceRange?.minVariantPrice?.currencyCode,
            ),
            img: node?.featuredImage?.url ?? '',
            href: `/product/${node?.handle}`,
            badge: node?.tags?.includes('new') ? 'New' : undefined,
          })) ?? [];
        setProductResults(cards.filter((card) => card.href));
      })
      .catch((error) => {
        console.error('Overlay search failed', error);
        if (!cancelled) setProductResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, query, popularProducts, searchIndex]);

  const suggestionItems = useMemo(
    () => buildSuggestions(catalogProducts, query, 6),
    [catalogProducts, query],
  );

  const performSearch = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    persistRecentSearch(trimmed);
    onClose();
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    performSearch(query);
  };

  const handleSuggestion = (value) => {
    if (!value) return;
    performSearch(value);
  };

  const handleProductClick = (href) => {
    onClose();
    navigate(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-white/90 backdrop-blur overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <h2 className="text-xs uppercase tracking-[0.35em] text-neutral-500">Search</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for products..."
              className="w-full border-b border-neutral-900 bg-transparent pb-3 pr-10 text-[16px] uppercase tracking-[0.3em] text-neutral-900 placeholder:text-neutral-400 focus:outline-none sm:text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-0 top-0 mt-1 rounded-full p-2 text-xs uppercase tracking-[0.3em] text-neutral-400 transition hover:text-neutral-900"
                aria-label="Clear search"
              >
                x
              </button>
            )}
          </div>
        </form>

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
          <div>
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">
                    Recent
                  </p>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="text-[10px] uppercase tracking-[0.28em] text-neutral-400 transition hover:text-neutral-900"
                  >
                    Clear
                  </button>
                </div>
                <ul className="mt-4 space-y-2 text-sm uppercase tracking-[0.25em] text-neutral-700">
                  {recentSearches.map((item) => (
                    <li key={`recent-${item}`} className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="flex-1 text-left transition hover:text-neutral-900"
                        onClick={() => handleSuggestion(item)}
                      >
                        {item}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecentSearch(item)}
                        className="rounded-full border border-neutral-200 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-neutral-400 transition hover:border-neutral-900 hover:text-neutral-900"
                        aria-label={`Remove ${item}`}
                      >
                        x
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">
              Suggestions
            </p>
            <ul className="mt-4 space-y-2 text-sm uppercase tracking-[0.25em] text-neutral-700">
              {suggestionItems.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    className="w-full text-left transition hover:text-neutral-900"
                    onClick={() => handleSuggestion(item)}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">Products</p>
            <div className="mt-4 space-y-3">
              {loading ? (
                <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">
                  Searching for “{query}”…
                </p>
              ) : productResults.length === 0 ? (
                <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">
                  {query
                    ? `No results for “${query}”.`
                    : 'No featured products available right now.'}
                </p>
              ) : (
                productResults.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => handleProductClick(item.href)}
                    className="flex w-full items-center gap-4 rounded-xl border border-transparent p-2 text-left transition hover:border-neutral-200 hover:bg-white"
                  >
                    <div className="h-14 w-14 overflow-hidden rounded-lg bg-neutral-100">
                      {item.img ? (
                        <img
                          src={item.img}
                          alt={item.title || 'Product'}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.3em] text-neutral-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-[0.3em] text-neutral-900">
                        {item.title}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">
                        {item.price}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-4">
          <button
            type="button"
            onClick={() => performSearch(query)}
            disabled={!query.trim()}
            className="flex w-full items-center justify-between rounded-full border border-neutral-200 px-4 py-3 text-[11px] uppercase tracking-[0.32em] text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>Search for “{query || '...'}”</span>
            <span aria-hidden>↗</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
