// src/pages/SearchPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useCatalog } from '../contexts/catalog-context';
import { toProductCard } from '../lib/shopify';

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

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const { products: catalogProducts, loading: catalogLoading } = useCatalog();
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  const trimmedQuery = initialQuery.trim();

  const searchIndex = useMemo(
    () =>
      (catalogProducts ?? []).map((product) => ({
        product,
        haystack: buildSearchableText(product),
      })),
    [catalogProducts],
  );

  const productResults = useMemo(() => {
    if (!trimmedQuery) return [];
    const tokens = normalizeSearchText(trimmedQuery).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    return searchIndex
      .filter(({ haystack }) => tokens.every((token) => haystack.includes(token)))
      .map(({ product }) => toProductCard(product))
      .filter(Boolean);
  }, [trimmedQuery, searchIndex]);

  const persistRecentSearch = useCallback((term) => {
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
  }, []);

  const removeRecentSearch = useCallback((term) => {
    setRecentSearches((prev) => {
      const normalized = normalizeSearchText(term);
      const next = prev.filter((item) => normalizeSearchText(item) !== normalized);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(recentSearchKey, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(recentSearchKey, JSON.stringify([]));
    }
  }, []);

  const suggestions = useMemo(
    () => buildSuggestions(catalogProducts, trimmedQuery, 6),
    [catalogProducts, trimmedQuery],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) return;
    persistRecentSearch(nextQuery);
    setSearchParams({ q: nextQuery });
  };

  useEffect(() => {
    if (trimmedQuery) {
      persistRecentSearch(trimmedQuery);
    }
  }, [trimmedQuery, persistRecentSearch]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-xs uppercase tracking-[0.35em] text-neutral-600">Search</h1>
        <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              placeholder="Search products..."
              onChange={(event) => setQuery(event.target.value)}
              className="w-full border-b border-neutral-900 bg-transparent pb-2 pr-10 text-[16px] uppercase tracking-[0.3em] text-neutral-900 placeholder:text-neutral-400 focus:outline-none sm:text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-0 top-0 mt-1 rounded-full p-2 text-xs uppercase tracking-[0.3em] text-neutral-400 transition hover:text-neutral-900"
                aria-label="Clear search"
              >
                x
              </button>
            )}
          </div>
          <button
            type="submit"
            className="rounded-full border border-neutral-900 px-5 py-2 text-[11px] uppercase tracking-[0.32em] text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
          >
            Search
          </button>
        </form>

        {trimmedQuery && (
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-neutral-500">
            Showing results for “{trimmedQuery}”
          </p>
        )}
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside>
          {recentSearches.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">
                  Recent
                </h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[10px] uppercase tracking-[0.28em] text-neutral-400 transition hover:text-neutral-900"
                >
                  Clear
                </button>
              </div>
              <ul className="mt-4 space-y-2 text-sm uppercase tracking-[0.25em] text-neutral-600">
                {recentSearches.map((item) => (
                  <li key={`recent-${item}`} className="flex items-center justify-between gap-2">
                    <Link
                      to={`/search?q=${encodeURIComponent(item)}`}
                      onClick={() => persistRecentSearch(item)}
                      className="flex-1 transition hover:text-neutral-900"
                    >
                      {item}
                    </Link>
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
          <h2 className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            Suggestions
          </h2>
          <ul className="mt-4 space-y-2 text-sm uppercase tracking-[0.25em] text-neutral-600">
            {suggestions.map((item) => (
              <li key={item}>
                <Link
                  to={`/search?q=${encodeURIComponent(item)}`}
                  onClick={() => persistRecentSearch(item)}
                  className="transition hover:text-neutral-900"
                >
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div>
          {trimmedQuery ? (
            catalogLoading ? (
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                Searching for “{trimmedQuery}”…
              </p>
            ) : productResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {productResults.map((item) => (
                  <ProductCard key={item.href} item={item} />
                ))}
              </div>
            ) : (
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                No products matched “{trimmedQuery}”.
              </p>
            )
          ) : (
            <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
              Start typing to discover the latest drops.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default SearchPage;
