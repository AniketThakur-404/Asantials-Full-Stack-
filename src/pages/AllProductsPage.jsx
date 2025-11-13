// src/pages/AllProductsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronDown, Star } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useCatalog } from '../contexts/catalog-context';
import { extractOptionValues, normaliseTokenValue, toProductCard } from '../lib/shopify';

const toneReviews = [
  {
    initials: 'KS',
    name: 'Karan S.',
    role: 'Verified Drop Member',
    quote:
      'Every drop feels limited and intentional. Fabric weight on the tees is exactly what I want for daily rotation.',
  },
  {
    initials: 'AA',
    name: 'Anaya A.',
    role: 'Studio Stylist',
    quote:
      'The hoodies hold their shape even after long shifts on set. Love the detailing and clean branding.',
  },
  {
    initials: 'RM',
    name: 'Rhea M.',
    role: 'Creative Consultant',
    quote:
      'Colour stories across the collection are so cohesive. Easy to build layered looks without overthinking.',
  },
  {
    initials: 'DV',
    name: 'Dhruv V.',
    role: 'Retail Partner',
    quote:
      'Customers ask for these fits by name. The oversized profiles and finishing feel premium straight off the rack.',
  },
];

const useActiveCategory = (initialCategory = 'all') => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('category') ?? initialCategory;

  const updateCategory = (value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === initialCategory) {
      next.delete('category');
    } else {
      next.set('category', value);
    }
    setSearchParams(next);
  };

  return { active, updateCategory };
};

const collectionsMeta = {
  't-shirts': 'T-Shirts',
  hoodies: 'Hoodies',
  shoes: 'Shoes',
  loafers: 'Loafers',
  boots: 'Boots',
  sneakers: 'Sneakers',
  sandals: 'Sandals',
};

const availabilityOptions = [
  { value: 'in-stock', label: 'In Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
];

const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price, Low to High' },
  { value: 'price-desc', label: 'Price, High to Low' },
  { value: 'title-asc', label: 'Alphabetical, A-Z' },
  { value: 'title-desc', label: 'Alphabetical, Z-A' },
];

const AllProductsPage = ({ initialCategory = 'all' } = {}) => {
  const { active, updateCategory } = useActiveCategory(initialCategory);
  const location = useLocation();
  const {
    products: catalogProducts,
    collections,
    loading: catalogLoading,
    ensureCollectionProducts,
  } = useCatalog();
  const [collectionProducts, setCollectionProducts] = useState({});
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [sizeFilterOpen, setSizeFilterOpen] = useState(false);
  const [availabilityFilterOpen, setAvailabilityFilterOpen] = useState(false);
  const sizePopoverRef = useRef(null);
  const availabilityPopoverRef = useRef(null);

  const navItems = useMemo(() => {
    const items = [{ value: 'all', label: 'View All' }];
    Object.entries(collectionsMeta).forEach(([value, label]) => {
      items.push({ value, label });
    });
    (collections ?? [])
      .filter((collection) => collection?.handle && collection?.title)
      .forEach((collection) => {
        if (!items.some((item) => item.value === collection.handle)) {
          items.push({ value: collection.handle, label: collection.title });
        }
      });
    return items;
  }, [collections]);

  const hasCollectionProducts = collectionProducts[active];

  useEffect(() => {
    if (active === 'all' || hasCollectionProducts) return;
    let cancelled = false;
    setCollectionLoading(true);

    ensureCollectionProducts(active, { limit: 60 })
      .then((productsForCollection) => {
        if (cancelled || !productsForCollection) return;
        setCollectionProducts((prev) => ({
          ...prev,
          [active]: productsForCollection,
        }));
      })
      .catch((error) => {
        console.error(`Failed to load collection "${active}"`, error);
      })
      .finally(() => {
        if (!cancelled) {
          setCollectionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, hasCollectionProducts, ensureCollectionProducts]);

  const filteredProducts = useMemo(() => {
    if (active === 'all') return catalogProducts ?? [];
    return collectionProducts[active] ?? [];
  }, [active, catalogProducts, collectionProducts]);

  const sizeOptions = useMemo(() => {
    const values = new Set();
    filteredProducts.forEach((product) => {
      extractOptionValues(product, 'size').forEach((size) => {
        if (size) {
          values.add(size);
        }
      });
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [filteredProducts]);

  const availabilityCounts = useMemo(() => {
    let inStock = 0;
    let outOfStock = 0;
    filteredProducts.forEach((product) => {
      const productInStock = product.variants?.some((variant) => variant.availableForSale);
      if (productInStock) {
        inStock += 1;
      } else {
        outOfStock += 1;
      }
    });
    return { 'in-stock': inStock, 'out-of-stock': outOfStock };
  }, [filteredProducts]);

  useEffect(() => {
    if (sizeOptions.length === 0) {
      setSelectedSizes([]);
      setSizeFilterOpen(false);
    }
  }, [sizeOptions]);

  const filteredAndSortedProducts = useMemo(() => {
    const selectedTokens = selectedSizes.map((size) => normaliseTokenValue(size));
    const hasSizeFilter = selectedTokens.length > 0;
    const matchesSize = (product) => {
      if (!hasSizeFilter) return true;
      const productSizes = extractOptionValues(product, 'size').map((value) =>
        normaliseTokenValue(value),
      );
      if (!productSizes.length) return false;
      return selectedTokens.some((token) => productSizes.includes(token));
    };
    const matchesAvailability = (product) => {
      if (availabilityFilter === 'all') return true;
      const productInStock = product.variants?.some((variant) => variant.availableForSale);
      if (availabilityFilter === 'in-stock') return productInStock;
      if (availabilityFilter === 'out-of-stock') {
        return product.variants?.every((variant) => !variant.availableForSale);
      }
      return true;
    };
    const compareFns = {
      featured: () => 0,
      'price-asc': (a, b) => (a.price ?? 0) - (b.price ?? 0),
      'price-desc': (a, b) => (b.price ?? 0) - (a.price ?? 0),
      'title-asc': (a, b) => a.title.localeCompare(b.title),
      'title-desc': (a, b) => b.title.localeCompare(a.title),
    };
    const comparator = compareFns[sortBy] ?? compareFns.featured;
    return filteredProducts
      .filter((product) => matchesSize(product) && matchesAvailability(product))
      .slice()
      .sort(comparator);
  }, [filteredProducts, selectedSizes, availabilityFilter, sortBy]);

  const totalCount = filteredAndSortedProducts.length;
  const isLoading =
    catalogLoading || (active !== 'all' && !collectionProducts[active] && collectionLoading);
  const productCards = useMemo(
    () => filteredAndSortedProducts.map(toProductCard).filter(Boolean),
    [filteredAndSortedProducts],
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sizeFilterOpen &&
        sizePopoverRef.current &&
        !sizePopoverRef.current.contains(event.target)
      ) {
        setSizeFilterOpen(false);
      }
      if (
        availabilityFilterOpen &&
        availabilityPopoverRef.current &&
        !availabilityPopoverRef.current.contains(event.target)
      ) {
        setAvailabilityFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sizeFilterOpen, availabilityFilterOpen]);

  useEffect(() => {
    setSizeFilterOpen(false);
    setAvailabilityFilterOpen(false);
  }, [active]);

  const toggleSize = (size) => {
    setSelectedSizes((prev) => {
      if (prev.includes(size)) {
        return prev.filter((value) => value !== size);
      }
      return [...prev, size];
    });
  };

  const pageTitle =
    active === 'all'
      ? 'All Products'
      : collectionsMeta[active] ?? collections?.find((c) => c.handle === active)?.title ?? 'All Products';

  return (
    <section className="site-shell section-gap max-w-[1600px] lg:px-2">
      <header className="space-y-8 border-b border-neutral-200 pb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xs uppercase tracking-[0.35em] text-neutral-600">{pageTitle}</h1>
          <div className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">
            {totalCount} styles
          </div>
        </div>

        <nav className="flex flex-wrap gap-4 text-[11px] uppercase tracking-[0.3em] text-neutral-500">
          {navItems.map((item) => {
            const isActive = (item.value === 'all' && active === 'all') || active === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => updateCategory(item.value)}
                className="group relative pb-1"
              >
                <span
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-neutral-900' : 'text-neutral-500 group-hover:text-neutral-900'
                  }`}
                >
                  {item.label}
                </span>
                <span
                  className={`absolute bottom-0 left-0 h-[2px] w-full origin-center transform rounded-full bg-neutral-900 transition-all duration-200 ${
                    isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-60'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-[0.32em] text-neutral-500">
          <div className="flex items-center gap-3">
            <div className="relative" ref={sizePopoverRef}>
              <button
                type="button"
                disabled={sizeOptions.length === 0}
                onClick={() => setSizeFilterOpen((prev) => !prev)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 transition ${
                  sizeOptions.length === 0
                    ? 'cursor-not-allowed border-neutral-200 text-neutral-300'
                    : 'border-neutral-200 hover:border-neutral-900 hover:text-neutral-900'
                }`}
                aria-expanded={sizeFilterOpen}
              >
                Size {selectedSizes.length > 0 && `(${selectedSizes.length})`}
                <ChevronDown className={`h-3 w-3 transition ${sizeFilterOpen ? 'rotate-180' : ''}`} />
              </button>
              {sizeFilterOpen && sizeOptions.length > 0 && (
                <div className="absolute left-0 z-40 mt-3 w-64 rounded-3xl border border-neutral-200 bg-white p-4 text-[10px] tracking-[0.3em] text-neutral-500 shadow-[0_25px_65px_-40px_rgba(0,0,0,0.55)]">
                  <div className="flex items-center justify-between text-[9px] uppercase">
                    <span>{selectedSizes.length} selected</span>
                    <button
                      type="button"
                      className="text-neutral-900 underline"
                      onClick={() => setSelectedSizes([])}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-2 text-[11px] uppercase tracking-[0.2em] text-neutral-700">
                    {sizeOptions.map((size) => {
                      const checked = selectedSizes.includes(size);
                      return (
                        <label key={size} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSize(size)}
                            className="h-3 w-3 border border-neutral-400"
                          />
                          <span className={checked ? 'text-neutral-900' : undefined}>{size}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={availabilityPopoverRef}>
              <button
                type="button"
                onClick={() => setAvailabilityFilterOpen((prev) => !prev)}
                className={`flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 transition hover:border-neutral-900 hover:text-neutral-900 ${
                  availabilityFilter !== 'all' ? 'border-neutral-900 text-neutral-900' : ''
                }`}
                aria-expanded={availabilityFilterOpen}
              >
                Availability
                {availabilityFilter !== 'all' && (
                  <span className="text-neutral-400">({availabilityFilter.replace('-', ' ')})</span>
                )}
                <ChevronDown
                  className={`h-3 w-3 transition ${availabilityFilterOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {availabilityFilterOpen && (
                <div className="absolute left-0 z-40 mt-3 w-56 rounded-3xl border border-neutral-200 bg-white p-4 text-[10px] tracking-[0.3em] text-neutral-500 shadow-[0_25px_65px_-40px_rgba(0,0,0,0.55)]">
                  <div className="flex items-center justify-between text-[9px] uppercase">
                    <span>
                      {availabilityFilter === 'all'
                        ? '0 selected'
                        : availabilityFilter.replace('-', ' ')}
                    </span>
                    <button
                      type="button"
                      className="text-neutral-900 underline"
                      onClick={() => setAvailabilityFilter('all')}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] uppercase tracking-[0.2em] text-neutral-700">
                    {availabilityOptions.map((option) => {
                      const checked = availabilityFilter === option.value;
                      return (
                        <label key={option.value} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setAvailabilityFilter((prev) =>
                                prev === option.value ? 'all' : option.value,
                              )
                            }
                            className="h-3 w-3 border border-neutral-400"
                          />
                          <span className={checked ? 'text-neutral-900' : undefined}>
                            {option.label}{' '}
                            <span className="text-neutral-400">
                              ({availabilityCounts[option.value] ?? 0})
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
            <span>Sort by:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="appearance-none rounded-full border border-neutral-200 bg-white px-5 py-2 text-[10px] uppercase tracking-[0.3em] text-neutral-700 transition hover:border-neutral-900 focus:outline-none"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
            </div>
          </div>
        </div>
      </header>

      <div className="mt-10 min-h-[200px]">
        {isLoading ? (
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
            Loading products…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
            {productCards.length > 0 ? (
              productCards.map((item) => <ProductCard key={item.href} item={item} />)
            ) : (
              <p className="col-span-full text-sm uppercase tracking-[0.3em] text-neutral-500">
                No products available in this selection.
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="mt-16 rounded-3xl border border-neutral-200 p-6 text-center text-xs uppercase tracking-[0.3em] text-neutral-500">
        Looking for something specific?{' '}
        <Link
          to={`/search${location.search}`}
          className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
        >
          Use the search experience
        </Link>
      </footer>

      <section className="mt-20 border-t border-neutral-200 pt-12">
        <div className="flex flex-col gap-4 text-neutral-900 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">Collective Notes</p>
            <h2 className="mt-2 text-lg uppercase tracking-[0.28em]">Trusted by the Crew</h2>
          </div>
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="h-4 w-4 fill-current" strokeWidth={1.5} />
            ))}
          </div>
        </div>

        <div className="reviews-marquee group mt-8 pb-4">
          <div className="reviews-marquee__track">
            {[...toneReviews, ...toneReviews].map((review, index) => (
              <article
                key={`${review.name}-${index}`}
                className="reviews-marquee__card flex min-h-[220px] flex-col justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] uppercase tracking-[0.2em] text-white">
                    {review.initials}
                  </div>
                  <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                    <p className="text-neutral-900">{review.name}</p>
                    <p>{review.role}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-neutral-600">{review.quote}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
};

export default AllProductsPage;
