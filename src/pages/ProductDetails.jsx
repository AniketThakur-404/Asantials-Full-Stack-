import React, { useEffect, useMemo, useState } from 'react';
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

  // Always fetch fresh product (metafields included)
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
            const recs = await fetchRecommendedProducts(full.id, 4);
            if (!cancelled) {
              const cards =
                recs?.map((item) => {
                  const amount = item?.priceRange?.minVariantPrice?.amount;
                  const currency = item?.priceRange?.minVariantPrice?.currencyCode;
                  return {
                    title: item?.title ?? 'Recommended Item',
                    price: formatMoney(amount, currency),
                    img: item?.featuredImage?.url ?? '',
                    href: `/product/${item?.handle}`,
                    badge: item?.tags?.includes('new') ? 'New' : undefined,
                  };
                }) ?? [];
              setRelatedProducts(cards.filter(Boolean));
            }
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

  const sizeOptions = useMemo(() => product?.optionValues?.size ?? [], [product]);
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

  /** Get a metafield value by key(s), case-insensitive; trims and drops empty strings */
  const getMetafieldValue = (keys) => {
    if (!product?.metafields?.length) return null;
    const keyList = Array.isArray(keys)
      ? keys.map((key) => String(key).toLowerCase())
      : [String(keys).toLowerCase()];
    const entry = product.metafields.find((field) =>
      keyList.includes((field?.key ?? '').toLowerCase())
    );
    if (!entry) return null;
    const raw = entry.value;
    if (raw == null) return null;
    if (typeof raw === 'string') {
      const t = raw.trim();
      return t.length ? t : null;
    }
    return raw;
  };

  // Only from Shopify metafields (no hardcoded fallbacks)
  const materialsInfo   = getMetafieldValue(['materials', 'material']);
  const weightInfo      = getMetafieldValue(['fabric_weight', 'weight']);
  const careInfo        = getMetafieldValue(['care', 'wash_care']);
  const shippingInfo    = getMetafieldValue(['shipping']);
  const sizeChartSource = getMetafieldValue(['size_chart_json', 'size_chart']);

  const sizeChartRows = useMemo(() => {
    if (sizeChartSource) {
      try {
        const parsed = JSON.parse(sizeChartSource);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => ({
              size: entry.size ?? entry.label ?? entry.title ?? entry.name,
              chest: entry.chest ?? entry.bust ?? entry.width ?? entry['chest (in)'],
              shoulder: entry.shoulder ?? entry['shoulder (in)'] ?? entry.across,
              length: entry.length ?? entry['length (in)'] ?? entry.height,
            }))
            .filter((row) => row.size);
        }
      } catch (e) {
        console.warn('Unable to parse size chart metafield', e);
      }
    }
    return null;
  }, [sizeChartSource]);

  const hasSizeChart = Boolean(sizeChartRows?.length);

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

  const priceLabel = formatMoney(product.price, product.currencyCode);
  const subheading = getSubheadingFromProduct(product);
  const descriptionHtml = product.descriptionHtml ?? `<p>${product.description ?? ''}</p>`;
  const featureTags = product.tags?.slice(0, 4) ?? [];

  return (
    <article className="bg-neutral-50 text-neutral-900">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-12 sm:px-6 md:px-8 lg:px-2">
        <div className="grid gap-y-12 lg:grid-cols-[320px_minmax(0,1fr)_360px] lg:gap-x-12">
          {/* Left column: title + info */}
          <div className="space-y-8 lg:sticky lg:top-28 lg:self-start">
            <Breadcrumbs title={product.title} className="mb-6" />
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold uppercase tracking-[0.25em] text-neutral-900">
                {product.title}
              </h1>
              {subheading?.text && (
                <p className="mt-2 text-sm uppercase tracking-[0.3em] text-neutral-500">
                  {subheading.text}
                </p>
              )}
              {subheading?.html && (
                <div
                  className="mt-2 text-sm uppercase tracking-[0.3em] text-neutral-500"
                  dangerouslySetInnerHTML={{ __html: subheading.html }}
                />
              )}
              <p className="mt-3 text-lg tracking-[0.18em] text-neutral-600">{priceLabel}</p>
            </div>

            <div className="space-y-6 text-sm leading-relaxed text-neutral-600">
              <section className="space-y-3">
                <h2 className="mb-2 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
                  Description
                </h2>
                <div
                  className="prose prose-sm max-w-none text-neutral-600"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              </section>

              {(materialsInfo || featureTags.length > 0) && (
                <section className="space-y-3 border-t border-neutral-200 pt-4">
                  <h2 className="mb-2 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
                    Details
                  </h2>
                  {materialsInfo && <p>{materialsInfo}</p>}
                  {featureTags.length > 0 && (
                    <ul className="mt-3 space-y-1 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                      {featureTags.map((tag) => (
                        <li key={tag}>#{tag}</li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {(weightInfo || careInfo) && (
                <section className="flex flex-wrap gap-6 border-t border-neutral-200 pt-4 text-xs uppercase tracking-[0.25em] text-neutral-700">
                  {weightInfo && <span>{weightInfo}</span>}
                  {careInfo && <span>{careInfo}</span>}
                </section>
              )}

              {shippingInfo && (
                <section className="space-y-3 border-t border-neutral-200 pt-4">
                  <h2 className="mb-2 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
                    Shipping
                  </h2>
                  <p>{shippingInfo}</p>
                </section>
              )}
            </div>
          </div>

          {/* Middle column: images */}
          <div className="space-y-8">
            {(product.images ?? [])
              .filter((image) => image?.url)
              .map((image, index) => (
                <img
                  key={image.url ?? index}
                  src={image.url}
                  alt={image.alt ?? `${product.title} view ${index + 1}`}
                  className="w-full border border-neutral-200 bg-neutral-200 object-cover"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              ))}
          </div>

          {/* Right column: actions */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="space-y-6 border border-neutral-200 bg-white p-6">
              {hasSizes && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">
                      Size
                    </h2>
                    <button
                      type="button"
                      onClick={() => hasSizeChart && setSizeChartOpen(true)}
                      disabled={!hasSizeChart}
                      className={`text-[10px] uppercase tracking-[0.3em] underline-offset-4 transition ${
                        hasSizeChart
                          ? 'text-neutral-900 hover:underline'
                          : 'cursor-not-allowed text-neutral-300'
                      }`}
                    >
                      Size Chart
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {sizeOptions.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`border px-3 py-3 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                          selectedSize === size
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
                  className="h-4 w-4 border border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <label htmlFor="giftCard" className="text-neutral-600">
                  Have a gift card?
                </label>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full border border-neutral-900 bg-neutral-900 py-4 text-[11px] uppercase tracking-[0.35em] text-white transition-transform duration-200 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 active:scale-95"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full border border-neutral-900 py-4 text-[11px] uppercase tracking-[0.35em] text-neutral-900 transition-transform duration-200 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 active:scale-95"
                >
                  Buy Now
                </button>
              </div>

              <section className="space-y-3">
                <h2 className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">
                  Delivery Details
                </h2>
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                  <input
                    type="text"
                    value={pincode}
                    onChange={(event) => setPincode(event.target.value)}
                    placeholder="Enter your pincode"
                    className="h-full border border-neutral-200 px-5 py-3 text-sm tracking-[0.2em] text-neutral-700 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  <button
                    type="button"
                    className="flex h-full items-center justify-center border border-neutral-900 px-5 text-[11px] uppercase tracking-[0.32em] text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
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
        <section className="mt-24">
          <div className="border-t border-neutral-200 py-4">
            <h2 className="text-[11px] uppercase tracking-[0.35em] text-neutral-600">
              You May Also Like
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <ProductCard key={item.href} item={item} />
            ))}
          </div>
        </section>
      )}

      {sizeChartOpen && hasSizeChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSizeChartOpen(false)}
          />
          <div className="relative z-10 w-full max-w-3xl border border-neutral-200 bg-white p-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">Size Chart</p>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
                  Measurements in inches
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSizeChartOpen(false)}
                className="text-[11px] uppercase tracking-[0.35em] text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline"
              >
                Close
              </button>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm text-neutral-700">
                <thead className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                  <tr>
                    <th className="border-b border-neutral-200 px-3 py-2 text-left">Size</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-left">Chest</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-left">Shoulder</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-left">Length</th>
                  </tr>
                </thead>
                <tbody>
                  {sizeChartRows.map((row) => (
                    <tr key={row.size} className="text-neutral-700">
                      <td className="border-b border-neutral-100 px-3 py-2 text-[11px] uppercase tracking-[0.3em]">
                        {row.size}
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-2">{row.chest ?? '-'}</td>
                      <td className="border-b border-neutral-100 px-3 py-2">{row.shoulder ?? '-'}</td>
                      <td className="border-b border-neutral-100 px-3 py-2">{row.length ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

export default ProductDetails;
