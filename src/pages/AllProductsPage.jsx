// src/pages/AllProductsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronDown, Star } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useCatalog } from '../contexts/catalog-context';
import { extractOptionValues, normaliseTokenValue, toProductCard } from '../lib/shopify';

// --- Static Data & Configuration ---
const toneReviews = [
  {
    initials: 'KS',
    name: 'Karan S.',
    role: 'Verified Drop Member',
    quote: 'Every drop feels limited and intentional. Fabric weight on the tees is exactly what I want for daily rotation.',
  },
  {
    initials: 'AA',
    name: 'Anaya A.',
    role: 'Studio Stylist',
    quote: 'The hoodies hold their shape even after long shifts on set. Love the detailing and clean branding.',
  },
  {
    initials: 'RM',
    name: 'Rhea M.',
    role: 'Creative Consultant',
    quote: 'Colour stories across the collection are so cohesive. Easy to build layered looks without overthinking.',
  },
  {
    initials: 'DV',
    name: 'Dhruv V.',
    role: 'Retail Partner',
    quote: 'Customers ask for these fits by name. The oversized profiles and finishing feel premium straight off the rack.',
  },
];

const collectionsMeta = {
  't-shirts': 'T-Shirts',
  jeans: 'Jeans',
  shoes: 'Shoes',
  loafers: 'Loafers',
  boots: 'Boots',
  sneakers: 'Sneakers',
  sandals: 'Sandals',
};

const shoeHandles = ['shoes', 'loafers', 'boots', 'sneakers', 'sandals'];

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

const hiddenHandles = new Set(['home-page', 'homepage', 'frontpage', 'front-page', 'home', 'home page']);

const categoryAliases = {
  hoodies: 'jeans',
};

const normalizeCategory = (value) =>
  value ? categoryAliases[value] ?? value : value;

const resolveCollectionHandle = (value, handles) => {
  if (!value || value !== 'jeans') return value;
  if (handles?.size) {
    if (handles.has('jeans')) return 'jeans';
    if (handles.has('hoodies')) return 'hoodies';
  }
  return value;
};

// --- Custom Hooks ---
const useActiveCategory = (initialCategory = 'all') => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawCategory = searchParams.get('category') ?? initialCategory;
  const active = normalizeCategory(rawCategory);
  const normalizedInitial = normalizeCategory(initialCategory);

  const updateCategory = (value) => {
    const next = new URLSearchParams(searchParams);
    const normalizedValue = normalizeCategory(value);
    if (!normalizedValue || normalizedValue === normalizedInitial) {
      next.delete('category');
    } else {
      next.set('category', normalizedValue);
    }
    setSearchParams(next);
  };

  return { active, updateCategory };
};

// --- Main Component ---
const AllProductsPage = ({ initialCategory = 'all' } = {}) => {
  // 1. State & Hooks
  const location = useLocation();
  const pathCategory = location.pathname.startsWith('/shoes') ? 'shoes' : initialCategory;
  const { active, updateCategory } = useActiveCategory(pathCategory);
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

  const collectionHandles = useMemo(
    () =>
      new Set(
        (collections ?? []).map((collection) => collection?.handle).filter(Boolean),
      ),
    [collections],
  );
  const activeCollectionHandle = resolveCollectionHandle(active, collectionHandles);

  // UI State for dropdowns
  const [sizeFilterOpen, setSizeFilterOpen] = useState(false);
  const [availabilityFilterOpen, setAvailabilityFilterOpen] = useState(false);
  const [currentReview, setCurrentReview] = useState(0);
  const sizePopoverRef = useRef(null);
  const availabilityPopoverRef = useRef(null);

  // Auto-advance the review carousel
  useEffect(() => {
    const timer = setInterval(
      () => setCurrentReview((prev) => (prev + 1) % toneReviews.length),
      3000,
    );
    return () => clearInterval(timer);
  }, []);

  // 2. Data Logic
  const navItems = useMemo(() => {
    const items = [{ value: 'all', label: 'View All' }];
    Object.entries(collectionsMeta).forEach(([value, label]) => {
      items.push({ value: normalizeCategory(value), label });
    });
    (collections ?? [])
      .filter(
        (collection) =>
          collection?.handle &&
          collection?.title &&
          !hiddenHandles.has(String(collection.handle).toLowerCase()),
      )
      .forEach((collection) => {
        const normalizedValue = normalizeCategory(collection.handle);
        if (!items.some((item) => item.value === normalizedValue)) {
          items.push({
            value: normalizedValue,
            label: collectionsMeta[normalizedValue] ?? collection.title,
          });
        }
      });
    return items;
  }, [collections]);

  const hasCollectionProducts = collectionProducts[activeCollectionHandle];

  useEffect(() => {
    if (active === 'all' || hasCollectionProducts) return;
    let cancelled = false;
    setCollectionLoading(true);

    ensureCollectionProducts(activeCollectionHandle, { limit: 60 })
      .then((productsForCollection) => {
        if (cancelled || !productsForCollection) return;
        setCollectionProducts((prev) => ({
          ...prev,
          [activeCollectionHandle]: productsForCollection,
        }));
      })
      .catch((error) =>
        console.error(`Failed to load collection "${activeCollectionHandle}"`, error),
      )
      .finally(() => {
        if (!cancelled) setCollectionLoading(false);
      });

    return () => { cancelled = true; };
  }, [active, activeCollectionHandle, hasCollectionProducts, ensureCollectionProducts]);

  // Ensure shoe sub-collections are loaded when viewing Shoes
  useEffect(() => {
    if (active !== 'shoes') return;
    let cancelled = false;

    const handlesToFetch = shoeHandles.filter((handle) => !collectionProducts[handle]);
    if (!handlesToFetch.length) return;

    setCollectionLoading(true);
    Promise.all(
      handlesToFetch.map((handle) =>
        ensureCollectionProducts(handle, { limit: 60 }).catch((error) => {
          console.error(`Failed to load shoe collection "${handle}"`, error);
          return null;
        }),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setCollectionProducts((prev) => {
          const next = { ...prev };
          results.forEach((productsForHandle, idx) => {
            const handle = handlesToFetch[idx];
            if (productsForHandle) {
              next[handle] = productsForHandle;
            }
          });
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setCollectionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, collectionProducts, ensureCollectionProducts]);

  const filteredProducts = useMemo(() => {
    if (active === 'all') return catalogProducts ?? [];
    if (active === 'shoes') {
      const merged = [];
      const seen = new Set();

      const addProduct = (product) => {
        if (!product?.id || seen.has(product.id)) return;
        seen.add(product.id);
        merged.push(product);
      };

      shoeHandles.forEach((handle) => {
        (collectionProducts[handle] ?? []).forEach(addProduct);
      });

      // Fallback: include any catalog products tagged to shoe collections
      (catalogProducts ?? []).forEach((product) => {
        const handles =
          product?.collections?.map((c) => String(c.handle || '').toLowerCase()) ?? [];
        if (handles.some((h) => shoeHandles.includes(h))) {
          addProduct(product);
        }
      });

      return merged;
    }
    return collectionProducts[activeCollectionHandle] ?? [];
  }, [active, activeCollectionHandle, catalogProducts, collectionProducts]);

  const collectSizes = (product) => {
    const values = new Set();
    (product?.options ?? []).forEach((opt) => {
      if (opt?.name?.toLowerCase().includes('size')) {
        (opt.values ?? []).forEach((v) => v && values.add(v));
      }
    });
    (product?.variants ?? []).forEach((variant) => {
      (variant?.selectedOptions ?? []).forEach((opt) => {
        if (opt?.name?.toLowerCase().includes('size') && opt?.value) {
          values.add(opt.value);
        }
      });
    });
    // Fallback to legacy helper
    extractOptionValues(product, 'size').forEach((v) => v && values.add(v));
    return Array.from(values);
  };

  const sizeOptions = useMemo(() => {
    const values = new Set();
    filteredProducts.forEach((product) => {
      collectSizes(product).forEach((size) => values.add(size));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [filteredProducts]);

  const filteredAndSortedProducts = useMemo(() => {
    const selectedTokens = selectedSizes.map((size) => normaliseTokenValue(size));
    const hasSizeFilter = selectedTokens.length > 0;
    
    const matchesSize = (product) => {
      if (!hasSizeFilter) return true;
      const productSizes = collectSizes(product).map((value) => normaliseTokenValue(value));
      if (!productSizes.length) return false;
      return selectedTokens.some((token) => productSizes.includes(token));
    };

    const matchesAvailability = (product) => {
      if (availabilityFilter === 'all') return true;
      const productInStock = product.variants?.some((variant) => variant.availableForSale);
      if (availabilityFilter === 'in-stock') return productInStock;
      if (availabilityFilter === 'out-of-stock') return product.variants?.every((variant) => !variant.availableForSale);
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

  const productCards = useMemo(
    () => filteredAndSortedProducts.map(toProductCard).filter(Boolean),
    [filteredAndSortedProducts],
  );

  const totalCount = filteredAndSortedProducts.length;
  const isLoading =
    catalogLoading ||
    (active !== 'all' && !collectionProducts[activeCollectionHandle] && collectionLoading);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sizeFilterOpen && sizePopoverRef.current && !sizePopoverRef.current.contains(event.target)) {
        setSizeFilterOpen(false);
      }
      if (availabilityFilterOpen && availabilityPopoverRef.current && !availabilityPopoverRef.current.contains(event.target)) {
        setAvailabilityFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sizeFilterOpen, availabilityFilterOpen]);

  // Reset filters on category change
  useEffect(() => {
    setSizeFilterOpen(false);
    setAvailabilityFilterOpen(false);
  }, [active]);

  const toggleSize = (size) => {
    setSelectedSizes((prev) => prev.includes(size) ? prev.filter((v) => v !== size) : [...prev, size]);
  };

  // 3. Render
  return (
    <div className="w-full bg-[#f2f2f2] font-sans text-black">
      
      {/* --- SECONDARY NAVIGATION STRIP --- 
          "View All" anchored left, Categories centered. 
          Matches reference layout below main header.
      */}
      <nav className="relative flex flex-wrap items-center gap-3 border-b border-neutral-300 bg-[#f2f2f2] px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-10 lg:pt-8 mb-4">
        
        {/* Left Anchor: View All */}
        <div className="z-10 mr-auto shrink-0">
          <button
            onClick={() => updateCategory('all')}
            className={`text-[12px] font-bold uppercase tracking-wide underline underline-offset-4 ${
              active === 'all' ? 'text-black' : 'text-neutral-600'
            }`}
          >
            View All
          </button>
        </div>

        {/* Center: Scrollable Category List */}
        {/* We use absolute positioning on large screens to ensure true centering relative to screen, 
            but flex on small screens for scrollability */}
        <div className="flex flex-1 justify-center gap-4 overflow-x-auto px-2 scrollbar-hide sm:gap-6 lg:max-w-[780px] lg:mx-auto lg:px-0">
          {navItems
            .filter((item) => item.value !== 'all')
            .map((item) => {
               const isActive = active === item.value;
               return (
                <button
                  key={item.value}
                  onClick={() => updateCategory(item.value)}
                  className={`whitespace-nowrap text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    isActive ? 'text-black' : 'text-neutral-500 hover:text-black'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
        </div>
        
        {/* Right Spacer (Hidden on mobile) to balance layout if not using absolute centering */}
        <div className="hidden lg:block lg:w-[60px] shrink-0"></div>
      </nav>

      {/* --- FILTER & SORT BAR --- */}
      <div className="flex flex-col justify-between gap-4 px-4 py-6 text-[11px] uppercase tracking-wide sm:px-6 lg:flex-row lg:items-center lg:px-10 lg:mt-1 mt-2">
        
        {/* Left: Filters */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <span className="font-bold">Filter:</span>
          
          {/* Size Filter */}
          <div className="relative" ref={sizePopoverRef}>
            <button
              onClick={() => setSizeFilterOpen(!sizeFilterOpen)}
              className="flex items-center gap-1 hover:text-neutral-600"
            >
              Size {selectedSizes.length > 0 && `(${selectedSizes.length})`}
              <ChevronDown className={`h-3 w-3 transition-transform ${sizeFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {sizeFilterOpen && sizeOptions.length > 0 && (
                <div className="absolute left-0 z-30 mt-2 w-64 rounded-md border border-neutral-200 bg-white p-4 shadow-xl">
                    <div className="mb-3 flex justify-between text-[10px]">
                        <span>{selectedSizes.length} Selected</span>
                        <button onClick={() => setSelectedSizes([])} className="underline">Reset</button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {sizeOptions.map((size) => (
                            <button
                                key={size}
                                onClick={() => toggleSize(size)}
                                className={`border py-1 text-center transition ${selectedSizes.includes(size) ? 'bg-black text-white border-black' : 'border-neutral-200 hover:border-black'}`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>

          {/* Availability Filter */}
          <div className="relative" ref={availabilityPopoverRef}>
            <button
              onClick={() => setAvailabilityFilterOpen(!availabilityFilterOpen)}
              className="flex items-center gap-1 hover:text-neutral-600"
            >
              Availability
              <ChevronDown className={`h-3 w-3 transition-transform ${availabilityFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {availabilityFilterOpen && (
               <div className="absolute left-0 z-30 mt-2 w-48 rounded-md border border-neutral-200 bg-white p-4 shadow-xl">
                   {availabilityOptions.map((option) => (
                       <label key={option.value} className="flex cursor-pointer items-center gap-3 py-1">
                           <input 
                             type="checkbox" 
                             checked={availabilityFilter === option.value}
                             onChange={() => setAvailabilityFilter(prev => prev === option.value ? 'all' : option.value)}
                             className="accent-black"
                           />
                           <span>{option.label}</span>
                       </label>
                   ))}
               </div>
            )}
          </div>
        </div>

        {/* Right: Sort & Count */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
           <span className="text-neutral-500">Sort By:</span>
           <div className="relative">
             <select
               value={sortBy}
               onChange={(e) => setSortBy(e.target.value)}
               className="cursor-pointer appearance-none bg-transparent pr-4 font-bold uppercase focus:outline-none"
             >
               {sortOptions.map((opt) => (
                 <option key={opt.value} value={opt.value}>{opt.label}</option>
               ))}
             </select>
             <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2" />
           </div>
           <span className="text-neutral-400">{totalCount} Styles</span>
        </div>
      </div>

      {/* --- PRODUCTS GRID --- */}
      <div className="min-h-[400px] px-2 lg:px-2">
        {isLoading ? (
          <p className="py-20 text-center text-sm uppercase tracking-[0.3em] text-neutral-500">
            Loading products...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {productCards.length > 0 ? (
              productCards.map((item) => <ProductCard key={item.href} item={item} />)
            ) : (
              <p className="col-span-full py-20 text-center text-sm uppercase tracking-[0.3em] text-neutral-500">
                No products available.
              </p>
            )}
          </div>
        )}
      </div>

      {/* --- FOOTER SECTION --- */}
      <footer className="mt-16 border-t border-neutral-300 p-6 text-center lg:p-10">
        <div className="mb-20">
             <h2 className="mb-4 text-xs uppercase tracking-[0.35em] text-neutral-500">Looking for more?</h2>
             <Link to={`/search${location.search}`} className="text-sm font-bold uppercase underline underline-offset-4">
                 Use the search experience
             </Link>
        </div>

        <div className="border-t border-neutral-300 pt-12 text-left">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500">Collective Notes</p>
              <h3 className="mt-2 text-xl font-bold uppercase tracking-wide">Trusted by the Crew</h3>
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-black text-black" />
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div
                className="flex transition-transform duration-500"
                style={{ transform: `translateX(-${currentReview * 100}%)` }}
              >
                {toneReviews.map((review, i) => (
                  <article key={i} className="min-w-full px-6 py-8 sm:px-10 sm:py-10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-[10px] uppercase text-white sm:h-12 sm:w-12">
                        {review.initials}
                      </div>
                      <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                        <p className="text-neutral-900">{review.name}</p>
                        <p>{review.role}</p>
                      </div>
                    </div>
                    <p className="mt-6 text-sm leading-relaxed text-neutral-700">"{review.quote}"</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentReview((prev) => (prev - 1 + toneReviews.length) % toneReviews.length)
                  }
                  className="h-9 w-9 rounded-full border border-neutral-300 text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
                  aria-label="Previous review"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentReview((prev) => (prev + 1) % toneReviews.length)}
                  className="h-9 w-9 rounded-full border border-neutral-300 text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
                  aria-label="Next review"
                >
                  ›
                </button>
              </div>
              <div className="flex items-center gap-2">
                {toneReviews.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentReview(index)}
                    className={`h-2 w-6 rounded-full transition ${
                      currentReview === index
                        ? 'bg-neutral-900'
                        : 'bg-neutral-300 hover:bg-neutral-500'
                    }`}
                    aria-label={`Go to review ${index + 1}`}
                    aria-pressed={currentReview === index}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AllProductsPage;

