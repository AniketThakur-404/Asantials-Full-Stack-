// src/pages/SearchPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useCatalog } from '../contexts/catalog-context';
import { formatMoney, searchProducts } from '../lib/shopify';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const { products: catalogProducts } = useCatalog();
  const [productResults, setProductResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const trimmedQuery = initialQuery.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      setProductResults([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchProducts(trimmedQuery, 24)
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
      .catch((searchError) => {
        console.error('Search request failed', searchError);
        if (!cancelled) {
          setError('We could not fetch search results. Please try again.');
          setProductResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trimmedQuery]);

  const suggestions = useMemo(() => {
    const keywords = [];
    (catalogProducts ?? []).forEach((product) => {
      if (product?.title) keywords.push(product.title);
      if (product?.handle) keywords.push(product.handle.replace(/-/g, ' '));
      if (Array.isArray(product?.tags)) {
        product.tags.forEach((tag) => {
          if (tag) keywords.push(tag.replace(/[-_]/g, ' '));
        });
      }
    });
    const uniqueKeywords = Array.from(
      new Set(keywords.map((value) => value.trim()).filter(Boolean)),
    );

    if (!trimmedQuery) {
      return uniqueKeywords.slice(0, 6);
    }
    const normalized = trimmedQuery.toLowerCase();
    const matches = uniqueKeywords.filter((value) =>
      value.toLowerCase().includes(normalized),
    );
    return Array.from(new Set([...matches, ...uniqueKeywords])).slice(0, 6);
  }, [catalogProducts, trimmedQuery]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) return;
    setSearchParams({ q: nextQuery });
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-xs uppercase tracking-[0.35em] text-neutral-600">Search</h1>
        <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-3">
          <input
            type="text"
            value={query}
            placeholder="Search products..."
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 border-b border-neutral-900 bg-transparent pb-2 text-base uppercase tracking-[0.3em] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
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
          <h2 className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            Suggestions
          </h2>
          <ul className="mt-4 space-y-2 text-sm uppercase tracking-[0.25em] text-neutral-600">
            {suggestions.map((item) => (
              <li key={item}>
                <Link
                  to={`/search?q=${encodeURIComponent(item)}`}
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
            loading ? (
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                Searching for “{trimmedQuery}”…
              </p>
            ) : error ? (
              <p className="text-sm uppercase tracking-[0.3em] text-red-600">{error}</p>
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
