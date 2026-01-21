import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useCart } from '../contexts/cart-context';
import { useNotifications } from '../components/NotificationProvider';
import { useCatalog } from '../contexts/catalog-context';
import {
  fetchProductByHandle,
  fetchRecommendedProducts,
  formatMoney,
  getSubheadingFromProduct,
  toProductCard,
} from '../lib/shopify';

const Breadcrumbs = ({ title, className = '' }) => (
  <nav
    aria-label="Breadcrumb"
    className={`text-[11px] uppercase tracking-[0.35em] text-neutral-500 ${className}`}
  >
    <ol className="flex flex-wrap items-center gap-2">
      <li>
        <Link to="/" className="transition-colors hover:text-neutral-900">
          Home
        </Link>
      </li>
      <li>/</li>
      <li>
        <Link to="/apparel" className="transition-colors hover:text-neutral-900">
          All Products
        </Link>
      </li>
      <li>/</li>
      <li className="text-neutral-900">{title}</li>
    </ol>
  </nav>
);

const NotFound = () => (
  <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
    <h1 className="text-xl font-semibold uppercase tracking-[0.35em] text-neutral-900">
      Product Not Found
    </h1>
    <p className="max-w-xl text-sm leading-relaxed text-neutral-600">
      The product you are looking for might be sold out or moved. Browse the latest arrivals and discover new pieces crafted in limited batches.
    </p>
    <Link
      to="/"
      className="border border-neutral-900 px-6 py-3 text-[11px] uppercase tracking-[0.32em] transition hover:bg-neutral-900 hover:text-white"
    >
      Back to Shop
    </Link>
  </section>
);

const ProductDetails = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { openCartDrawer } = useOutletContext() ?? {};
  const { addItem } = useCart();
  const { notify } = useNotifications();
  const { getProduct } = useCatalog();

  const initialProduct = getProduct(slug);
  const [product, setProduct] = useState(initialProduct ?? null);
  const [loading, setLoading] = useState(!initialProduct);
  const [error, setError] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);
  const [pincode, setPincode] = useState('');
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const imageRefs = useRef([]);
  const [showStickyCart, setShowStickyCart] = useState(false);
  const sizesSectionRef = useRef(null);

  // Always fetch fresh product (with metafields)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);

      const cached = getProduct(slug);
      if (!cancelled) {
        setProduct(cached ?? null);
        setLoading(!cached);
      }

      try {
        const full = await fetchProductByHandle(slug);
        if (!cancelled) setProduct(full ?? null);

        if (full?.id) {
          try {
            const recs = await fetchRecommendedProducts(full, 4);
            if (!cancelled) setRelatedProducts((recs ?? []).map(toProductCard).filter(Boolean));
          } catch (e) {
            console.warn('Unable to load recommended products', e);
            if (!cancelled) setRelatedProducts([]);
          }
        } else if (!cancelled) {
          setRelatedProducts([]);
        }
      } catch (e) {
        console.error(`Failed to load product "${slug}"`, e);
        if (!cancelled) {
          setError(e);
          setProduct(null);
          setRelatedProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug, getProduct]);

  useEffect(() => {
    setActiveImage(0);
  }, [product?.id]);

  /** Return the full metafield (value + type + reference) by key(s) */
  const getMetafield = (keys) => {
    if (!product?.metafields?.length) return null;
    const keyList = (Array.isArray(keys) ? keys : [keys]).map(k => String(k).toLowerCase());
    const entry = product.metafields.find((field) =>
      keyList.includes((field?.key ?? '').toLowerCase())
    );
    if (!entry) return null;
    if (typeof entry.value === 'string') {
      const t = entry.value.trim();
      entry.value = t.length ? t : null;
    }
    return entry;
  };

  const getMetafieldValue = (keys) => getMetafield(keys)?.value ?? null;

  // PDP data from metafields only (no hardcoded fallbacks)
  const materialsInfo = getMetafieldValue(['materials', 'material']);
  const weightInfo = getMetafieldValue(['fabric_weight', 'weight']);
  const careInfo = getMetafieldValue(['care', 'wash_care']);
  const originInfo = getMetafieldValue(['origin']);
  const shippingInfo = getMetafieldValue(['shipping']);
  const sizeChartField = getMetafield([
    'size_chart_json',
    'size_chart',
    'sizechart',
    'shoe_size_chart',
    'shoe_sizechart',
    'mens_shoe_size_chart',
    'mens_shoe_sizechart',
    'size_chart_url',
  ]);

  // Parse JSON/HTML/image/file for size chart
  const {
    sizeChartRows,
    sizeChartHtml,
    sizeChartImageUrl,
    sizeChartFileUrl,
    sizeChartColumns,
  } = useMemo(() => {
    const out = {
      sizeChartRows: null,
      sizeChartHtml: null,
      sizeChartImageUrl: null,
      sizeChartFileUrl: null,
      sizeChartColumns: [],
    };
    if (!sizeChartField) return out;

    const val = sizeChartField.value;

    // JSON array
    if (typeof val === 'string' && val.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(val.trim());
        if (Array.isArray(parsed)) {
          out.sizeChartRows = parsed
            .map((entry) => {
              if (!entry || typeof entry !== 'object') return null;
              return {
                size: entry.size ?? entry.label ?? entry.title ?? entry.name,
                chest: entry.chest ?? entry.bust ?? entry.width ?? entry['chest (in)'],
                shoulder: entry.shoulder ?? entry['shoulder (in)'] ?? entry.across,
                length:
                  entry.length ??
                  entry['length (in)'] ??
                  entry.height ??
                  entry.foot_length_cm ??
                  entry.foot_length_mm,
                us_size: entry.us_size,
                eu_size: entry.eu_size ?? entry.eu,
                foot_length_cm: entry.foot_length_cm,
                foot_length_mm: entry.foot_length_mm,
              };
            })
            .filter((row) => row?.size);
          return out;
        }
      } catch (e) {
        console.warn('Unable to parse size chart JSON', e);
      }
    }

    // JSON object containing array(s)
    if (typeof val === 'string' && val.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(val.trim());
        if (parsed && typeof parsed === 'object') {
          const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
          if (Array.isArray(firstArray)) {
            out.sizeChartRows = firstArray
              .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                return {
                  size: entry.size ?? entry.label ?? entry.title ?? entry.name,
                  chest: entry.chest ?? entry.bust ?? entry.width ?? entry['chest (in)'],
                  shoulder: entry.shoulder ?? entry['shoulder (in)'] ?? entry.across,
                  length:
                    entry.length ??
                    entry['length (in)'] ??
                    entry.height ??
                    entry.foot_length_cm ??
                    entry.foot_length_mm,
                  us_size: entry.us_size,
                  eu_size: entry.eu_size ?? entry.eu,
                  foot_length_cm: entry.foot_length_cm,
                  foot_length_mm: entry.foot_length_mm,
                };
              })
              .filter((row) => row?.size);
            return out;
          }
        }
      } catch (e) {
        console.warn('Unable to parse size chart JSON object', e);
      }
    }

    // HTML
    if (typeof val === 'string' && /<[^>]+>/.test(val)) {
      out.sizeChartHtml = val;
      return out;
    }

    // Direct URL in value
    if (typeof val === 'string' && /^https?:\/\//i.test(val)) {
      const lower = val.toLowerCase();
      if (/\.(png|jpe?g|webp|gif|svg)$/.test(lower)) out.sizeChartImageUrl = val;
      else out.sizeChartFileUrl = val;
      return out;
    }

    // File/image reference
    const ref = sizeChartField.reference;
    if (ref?.__typename === 'MediaImage') {
      out.sizeChartImageUrl = ref.image?.url || null;
      return out;
    }
    if (ref?.__typename === 'GenericFile') {
      const url = ref.url || null;
      if (url) {
        const lower = url.toLowerCase();
        if (/\.(png|jpe?g|webp|gif|svg)$/.test(lower)) out.sizeChartImageUrl = url;
        else out.sizeChartFileUrl = url;
      }
      return out;
    }

    // Build column definitions based on available keys
    if (out.sizeChartRows?.length) {
      const keyCounts = {};
      out.sizeChartRows.forEach((row) => {
        Object.entries(row || {}).forEach(([key, value]) => {
          if (key === 'size') return;
          if (value == null || value === '') return;
          keyCounts[key] = (keyCounts[key] || 0) + 1;
        });
      });
      const labels = {
        chest: 'Chest',
        bust: 'Bust',
        width: 'Width',
        shoulder: 'Shoulder',
        length: 'Length',
        foot_length_cm: 'Foot length (cm)',
        foot_length_mm: 'Foot length (mm)',
        us_size: 'US',
        eu_size: 'EU',
      };
      const preferredOrder = [
        'us_size',
        'eu_size',
        'foot_length_cm',
        'foot_length_mm',
        'chest',
        'shoulder',
        'length',
      ];
      out.sizeChartColumns = preferredOrder
        .filter((key) => keyCounts[key])
        .map((key) => ({ key, label: labels[key] || key }));
      if (!out.sizeChartColumns.length) {
        out.sizeChartColumns = Object.keys(keyCounts).map((key) => ({
          key,
          label: labels[key] || key,
        }));
      }
    }

    return out;
  }, [sizeChartField]);

  // Size options (variants, options, size chart fallback)
  const sizeOptions = useMemo(() => {
    if (!product) return [];
    const entries = Object.entries(product.optionValues || {});
    const byName =
      entries.find(([name]) => name === 'size') ||
      entries.find(([name]) => name.includes('size'));
    if (byName?.[1]?.length) return byName[1];

    const sizeOpt = (product.options || []).find((o) =>
      (o?.name || '').toLowerCase().includes('size'),
    );
    if (sizeOpt?.values?.length) {
      return sizeOpt.values.filter(
        (val) => val && !/default\s*title/i.test(String(val)),
      );
    }

    const variantSizes = new Set();
    (product.variants || []).forEach((variant) => {
      (variant.selectedOptions || []).forEach((option) => {
        if ((option?.name || '').toLowerCase().includes('size') && option?.value) {
          variantSizes.add(option.value);
        }
      });
      const title = variant?.title || '';
      if (title && !/default\s*title/i.test(title)) {
        title
          .split('/')
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((token) => variantSizes.add(token));
      }
    });

    if (variantSizes.size === 0 && sizeChartRows?.length) {
      sizeChartRows.forEach((row) => {
        if (row?.size) variantSizes.add(row.size);
      });
    }

    return Array.from(variantSizes);
  }, [product, sizeChartRows]);
  const hasSizes = sizeOptions.length > 0;

  useEffect(() => {
    if (!product) return;
    const focusSize = location.state?.focusSize;
    if (
      focusSize &&
      sizeOptions.some(
        (option) => option?.toLowerCase() === focusSize.toString().toLowerCase(),
      )
    ) {
      const matched =
        sizeOptions.find(
          (option) => option?.toLowerCase() === focusSize.toString().toLowerCase(),
        ) ?? sizeOptions[0] ?? null;
      setSelectedSize(matched);
    } else {
      setSelectedSize(sizeOptions[0] ?? null);
    }
    setPincode('');
  }, [product, sizeOptions, location.state]);

  const hasSizeChart =
    Boolean(sizeChartRows?.length) ||
    Boolean(sizeChartHtml) ||
    Boolean(sizeChartImageUrl) ||
    Boolean(sizeChartFileUrl);

  const canOpenSizeChart = Boolean(sizeChartField);

  useEffect(() => {
    const handleScroll = () => {
      if (!sizesSectionRef.current) return;
      const rect = sizesSectionRef.current.getBoundingClientRect();
      // Show sticky cart when the size section is scrolled past
      setShowStickyCart(rect.bottom < 0);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
  }, [product]);

  // Compute product images before conditional returns to maintain hook order
  const productImages = useMemo(
    () => (product?.images ?? []).filter((image) => image?.url),
    [product],
  );
  const hasMultipleImages = productImages.length > 1;
  const priceLabel = product ? formatMoney(product.price, product.currencyCode) : '';
  const heroImage = product?.featuredImage?.url ?? product?.images?.[0]?.url ?? '';

  useEffect(() => {
    if (activeImage > productImages.length - 1) {
      setActiveImage(0);
    }
  }, [activeImage, productImages.length]);

  useEffect(() => {
    imageRefs.current = imageRefs.current.slice(0, productImages.length);
  }, [productImages.length]);

  // Early returns after all hooks
  if (loading) {
    return (
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-neutral-500">
          Loading product…
        </p>
      </section>
    );
  }

  if (!product || error) {
    return <NotFound />;
  }

  const handleAddToCart = () => {
    const size = selectedSize ?? sizeOptions[0] ?? null;
    addItem(product.handle, { size: hasSizes ? size : null });
    notify({
      title: 'Added to Cart',
      message: `${product.title}${hasSizes && size ? ` - Size ${size}` : ''}`,
      actionLabel: 'View Cart',
      onAction: () => navigate('/cart'),
    });
    openCartDrawer?.();
  };

  const handleBuyNow = () => {
    const size = selectedSize ?? sizeOptions[0] ?? null;
    addItem(product.handle, { size: hasSizes ? size : null });
    if (openCartDrawer) openCartDrawer();
    else navigate('/cart');
  };



  const scrollToImage = (index) => {
    setActiveImage(index);
    const node = imageRefs.current[index];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  };

  const showPrevImage = () => {
    if (!productImages.length) return;
    const nextIndex = (activeImage - 1 + productImages.length) % productImages.length;
    scrollToImage(nextIndex);
  };

  const showNextImage = () => {
    if (!productImages.length) return;
    const nextIndex = (activeImage + 1) % productImages.length;
    scrollToImage(nextIndex);
  };

  const subheading = getSubheadingFromProduct(product);
  const descriptionHtml = product.descriptionHtml ?? `<p>${product.description ?? ''}</p>`;
  const featureTags = product.tags?.slice(0, 4) ?? [];
  const detailLines = [
    materialsInfo,
    weightInfo,
    originInfo,
    ...featureTags.map((tag) => tag.replace(/[-_]/g, ' ')),
    careInfo,
  ].filter(Boolean);
  const shippingLines = shippingInfo
    ? shippingInfo
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    : [];
  const infoSections = [
    {
      key: 'description',
      label: 'Description',
      content: (
        <div
          className="[&>*]:m-0 [&>*+*]:mt-3"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      ),
    },
    detailLines.length
      ? {
        key: 'details',
        label: 'Details',
        content: (
          <div className="space-y-2">
            {detailLines.map((line, index) => (
              <p key={`${line}-${index}`} className="m-0">
                {line}
              </p>
            ))}
          </div>
        ),
      }
      : null,
    shippingLines.length
      ? {
        key: 'shipping',
        label: 'Shipping',
        content: (
          <div className="space-y-2">
            {shippingLines.map((line, index) => (
              <p key={`${line}-${index}`} className="m-0">
                {line}
              </p>
            ))}
          </div>
        ),
      }
      : null,
  ].filter(Boolean);

  return (
    <article className="bg-neutral-50 text-neutral-900">
      <div className="site-shell section-gap">
        <div className="grid gap-10 lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)_minmax(320px,380px)] lg:items-start lg:gap-14">
          {/* Info column */}
          <div className="order-2 space-y-8 lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <Breadcrumbs title={product.title} className="mb-2" />
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold uppercase tracking-[0.25em] text-neutral-900">
                {product.title}
              </h1>
              {subheading?.text && (
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                  {subheading.text}
                </p>
              )}
              {subheading?.html && (
                <div
                  className="text-sm uppercase tracking-[0.3em] text-neutral-500"
                  dangerouslySetInnerHTML={{ __html: subheading.html }}
                />
              )}
              <p className="text-lg tracking-[0.18em] text-neutral-600">{priceLabel}</p>
            </div>

            {infoSections.length > 0 && (
              <div className="space-y-8 rounded border border-neutral-200 bg-white p-5">
                {infoSections.map((section, index) => (
                  <section
                    key={section.key}
                    className={`grid gap-4 items-start sm:grid-cols-[140px_minmax(0,1fr)] ${index > 0 ? 'border-t border-neutral-200 pt-6' : ''
                      }`}
                  >
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-900">
                      {section.label}
                    </h2>
                    <div className="space-y-3 text-[14px] leading-7 tracking-[0.08em] text-neutral-800 break-words uppercase [&_*]:m-0">
                      {section.content}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* Gallery column */}
          <div className="order-1 space-y-4 lg:order-2">
            {/* Mobile: carousel */}
            <div className="relative overflow-hidden rounded border border-neutral-200 bg-white lg:hidden">
              <div className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory bg-neutral-100 p-2 no-scrollbar">
                {productImages.length ? (
                  productImages.map((image, index) => (
                    <div
                      key={image.url ?? index}
                      ref={(el) => {
                        imageRefs.current[index] = el;
                      }}
                      className={`relative snap-start rounded-sm border ${activeImage === index ? 'border-neutral-900' : 'border-transparent'} min-w-[85%] sm:min-w-[65%]`}
                    >
                      <img
                        src={image.url}
                        alt={image.alt ?? `${product.title} view ${index + 1}`}
                        className="aspect-[4/5] w-full object-cover"
                        loading={index === 0 ? 'eager' : 'lazy'}
                        onClick={() => scrollToImage(index)}
                      />
                    </div>
                  ))
                ) : (
                  <div className="flex min-w-full items-center justify-center py-20 text-sm text-neutral-500">
                    Image coming soon
                  </div>
                )}
              </div>

              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    onClick={showPrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-neutral-900 shadow hover:bg-white"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-neutral-900 shadow hover:bg-white"
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/85 px-3 py-1">
                    {productImages.map((_, index) => (
                      <button
                        key={`dot-${index}`}
                        type="button"
                        className={`h-2.5 w-2.5 rounded-full transition ${activeImage === index ? 'bg-neutral-900' : 'bg-neutral-300'}`}
                        onClick={() => scrollToImage(index)}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Desktop: stacked images */}
            <div className="hidden flex-col gap-6 lg:flex">
              {productImages.length ? (
                productImages.map((image, index) => (
                  <img
                    key={image.url ?? index}
                    src={image.url}
                    alt={image.alt ?? `${product.title} view ${index + 1}`}
                    className="w-full max-w-[900px] rounded border border-neutral-200 bg-neutral-200 object-cover"
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                ))
              ) : (
                <div className="flex min-w-full items-center justify-center py-20 text-sm text-neutral-500">
                  Image coming soon
                </div>
              )}
            </div>

            {hasMultipleImages && (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar lg:hidden">
                {productImages.map((image, index) => (
                  <button
                    key={`thumb-${image.url ?? index}`}
                    type="button"
                    onClick={() => scrollToImage(index)}
                    className={`h-20 w-16 flex-shrink-0 overflow-hidden rounded border transition ${activeImage === index ? 'border-neutral-900' : 'border-neutral-200'
                      }`}
                  >
                    <img
                      src={image.url}
                      alt={image.alt ?? `${product.title} thumbnail ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions column */}
          <div className="order-3 lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-6 border border-neutral-200 bg-white p-6">
              {hasSizes && (
                <section ref={sizesSectionRef}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[11px] uppercase tracking-[0.32em] text-neutral-600">
                      Size
                    </h2>
                    <button
                      type="button"
                      onClick={() => canOpenSizeChart && setSizeChartOpen(true)}
                      disabled={!canOpenSizeChart}
                      className={`text-[10px] uppercase tracking-[0.26em] underline-offset-4 transition ${canOpenSizeChart
                        ? 'text-neutral-700 hover:underline'
                        : 'cursor-not-allowed text-neutral-300'
                        }`}
                    >
                      Size Chart
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {sizeOptions.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`border px-3 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition ${selectedSize === size
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-700 hover:border-neutral-900'
                          }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <div className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  id="giftCard"
                  className="h-4 w-4 rounded-sm border border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <label htmlFor="giftCard" className="text-neutral-600 uppercase tracking-[0.08em]">
                  Have a gift card?
                </label>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full border border-neutral-900 bg-neutral-900 py-4 text-[11px] uppercase tracking-[0.32em] text-white transition-transform duration-200 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 active:scale-95"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full border border-neutral-900 py-4 text-[11px] uppercase tracking-[0.32em] text-neutral-900 transition-transform duration-200 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 active:scale-95"
                >
                  Buy Now
                </button>
              </div>

              <section className="space-y-3">
                <h2 className="text-[11px] uppercase tracking-[0.32em] text-neutral-600">
                  Delivery Details
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                  <input
                    type="text"
                    value={pincode}
                    onChange={(event) => setPincode(event.target.value)}
                    placeholder="ENTER YOUR PINCODE"
                    className="h-full min-h-[52px] border border-neutral-300 px-5 py-3 text-sm tracking-[0.18em] text-neutral-700 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  <button
                    type="button"
                    className="flex h-full min-h-[52px] items-center justify-center border border-neutral-900 px-5 text-[11px] uppercase tracking-[0.32em] text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
                    onClick={() => {
                      if (!pincode.trim()) return;
                      window.alert(`Checking delivery availability for ${pincode.trim()}`);
                    }}
                  >
                    Check
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-24 pb-4">
          <div className="border-t border-neutral-200 py-6 px-2">
            <h2 className="text-[11px] uppercase tracking-[0.35em] text-neutral-600">
              You May Also Like
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <ProductCard key={item.href} item={item} />
            ))}
          </div>
        </section>
      )}

      {sizeChartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSizeChartOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">Size Chart</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                  Measurements may vary slightly by style
                </p>
              </div>
              <div className="flex justify-center md:justify-end">
                <button
                  type="button"
                  onClick={() => setSizeChartOpen(false)}
                  className="rounded-full border border-neutral-300 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
                >
                  Close
                </button>
              </div>
            </div>

            {/* JSON table */}
            {sizeChartRows?.length ? (
              <div className="mt-6 max-h-[55vh] overflow-x-auto overflow-y-auto rounded border border-neutral-100">
                {(() => {
                  const autoColumns =
                    sizeChartColumns && sizeChartColumns.length
                      ? sizeChartColumns
                      : (() => {
                        const keys = new Set();
                        sizeChartRows.forEach((row) => {
                          Object.keys(row || {}).forEach((key) => {
                            if (key === 'size') return;
                            if (row[key] == null || row[key] === '') return;
                            keys.add(key);
                          });
                        });
                        const preferred = ['us_size', 'eu_size', 'foot_length_cm', 'foot_length_mm', 'length', 'chest', 'shoulder'];
                        const ordered = preferred.filter((k) => keys.has(k));
                        const remaining = Array.from(keys).filter((k) => !preferred.includes(k));
                        const cols = [...ordered, ...remaining];
                        return cols.length
                          ? cols.map((key) => ({
                            key,
                            label:
                              {
                                us_size: 'US',
                                eu_size: 'EU',
                                foot_length_cm: 'Foot length (cm)',
                                foot_length_mm: 'Foot length (mm)',
                                length: 'Length',
                                chest: 'Chest',
                                shoulder: 'Shoulder',
                              }[key] || key,
                          }))
                          : [{ key: 'length', label: 'Length' }];
                      })();

                  return (
                    <table className="w-full border-collapse text-sm text-neutral-700 text-center md:text-left">
                      <thead className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 bg-neutral-50">
                        <tr>
                          <th className="border-b border-neutral-200 px-3 py-2 text-center md:text-left">Size</th>
                          {autoColumns.map((col) => (
                            <th
                              key={col.key}
                              className="border-b border-neutral-200 px-3 py-2 text-center md:text-left"
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sizeChartRows.map((row) => (
                          <tr key={row.size} className="text-neutral-700">
                            <td className="border-b border-neutral-100 px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-center md:text-left">
                              {row.size}
                            </td>
                            {autoColumns.map((col) => (
                              <td
                                key={`${row.size}-${col.key}`}
                                className="border-b border-neutral-100 px-3 py-2 text-center md:text-left"
                              >
                                {row[col.key] ?? '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            ) : null}

            {/* HTML */}
            {!sizeChartRows?.length && sizeChartHtml ? (
              <div
                className="prose prose-sm mt-6 max-w-none text-neutral-700"
                dangerouslySetInnerHTML={{ __html: sizeChartHtml }}
              />
            ) : null}

            {/* Image */}
            {!sizeChartRows?.length && !sizeChartHtml && sizeChartImageUrl ? (
              <div className="mt-6">
                <img
                  src={sizeChartImageUrl}
                  alt="Size chart"
                  className="w-full border border-neutral-200 bg-neutral-100 object-contain"
                />
              </div>
            ) : null}

            {/* File link (e.g., PDF or non-image) */}
            {!sizeChartRows?.length && !sizeChartHtml && !sizeChartImageUrl && sizeChartFileUrl ? (
              <div className="mt-6">
                <a href={sizeChartFileUrl} target="_blank" rel="noreferrer" className="underline">
                  Open size chart
                </a>
              </div>
            ) : null}

            {/* Fallback if metafield exists but nothing parseable */}
            {!sizeChartRows?.length && !sizeChartHtml && !sizeChartImageUrl && !sizeChartFileUrl && sizeChartField ? (
              <p className="mt-6 text-sm text-neutral-600">Size chart is not available in a supported format.</p>
            ) : null}
          </div>
        </div>
      )}

      {/* Sticky Add to Cart Bar */}
      {showStickyCart && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 shadow-lg">
          <div className="flex items-center gap-3 p-3">
            {/* Product Thumbnail */}
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded border border-neutral-200">
              <img
                src={heroImage}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-900 truncate">
                {product.title.length > 20 ? `${product.title.substring(0, 20)}...` : product.title}
              </h3>
              <p className="text-sm tracking-[0.12em] text-neutral-600">{priceLabel}</p>
            </div>

            {/* Add to Cart Button */}
            <button
              type="button"
              onClick={handleAddToCart}
              className="flex-shrink-0 border border-neutral-900 bg-neutral-900 px-6 py-3 text-[10px] uppercase tracking-[0.28em] text-white transition hover:bg-neutral-800"
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export default ProductDetails;
