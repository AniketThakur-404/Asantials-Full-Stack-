// src/pages/HomePage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import HeroWith3D from '../components/HeroWith3D';
import ProductGrid from '../components/ProductGrid';
import VideoBanner from '../components/VideoBanner';
import { useCatalog } from '../contexts/catalog-context';
import { toProductCard } from '../lib/shopify';
import heroVideo from '../assets/Coin_in_Nature_Climate_Video.mp4';

const PRIMARY_HANDLE = import.meta.env.VITE_SHOPIFY_HOME_PRIMARY_COLLECTION ?? null;
const SECONDARY_HANDLE = import.meta.env.VITE_SHOPIFY_HOME_SECONDARY_COLLECTION ?? null;

export default function HomePage() {
  const { products: catalogProducts, ensureCollectionProducts } = useCatalog();
  const [latestProducts, setLatestProducts] = useState([]);
  const [moreProducts, setMoreProducts] = useState([]);

  const fallbackLatest = useMemo(() => {
    if (!catalogProducts?.length) return [];
    return catalogProducts
      .slice(0, 4)
      .map((product) => toProductCard(product))
      .filter(Boolean);
  }, [catalogProducts]);

  const fallbackMore = useMemo(() => {
    if (!catalogProducts?.length) return [];
    return catalogProducts
      .slice(4, 8)
      .map((product) => toProductCard(product))
      .filter(Boolean);
  }, [catalogProducts]);

  useEffect(() => {
    let cancelled = false;

    async function loadPrimary() {
      if (!PRIMARY_HANDLE) {
        setLatestProducts(fallbackLatest);
        return;
      }
      try {
        const products = await ensureCollectionProducts(PRIMARY_HANDLE, { limit: 4 });
        if (cancelled) return;
        if (products?.length) {
          setLatestProducts(products.map((item) => toProductCard(item)).filter(Boolean));
        } else {
          setLatestProducts(fallbackLatest);
        }
      } catch (error) {
        console.warn(`Failed to load collection "${PRIMARY_HANDLE}"`, error);
        if (!cancelled) {
          setLatestProducts(fallbackLatest);
        }
      }
    }

    loadPrimary();

    return () => {
      cancelled = true;
    };
  }, [fallbackLatest, ensureCollectionProducts]);

  useEffect(() => {
    let cancelled = false;

    async function loadSecondary() {
      if (!SECONDARY_HANDLE) {
        setMoreProducts(fallbackMore);
        return;
      }
      try {
        const products = await ensureCollectionProducts(SECONDARY_HANDLE, { limit: 4 });
        if (cancelled) return;
        if (products?.length) {
          setMoreProducts(products.map((item) => toProductCard(item)).filter(Boolean));
        } else {
          setMoreProducts(fallbackMore);
        }
      } catch (error) {
        console.warn(`Failed to load collection "${SECONDARY_HANDLE}"`, error);
        if (!cancelled) {
          setMoreProducts(fallbackMore);
        }
      }
    }

    loadSecondary();

    return () => {
      cancelled = true;
    };
  }, [fallbackMore, ensureCollectionProducts]);

  return (
    <>
      <HeroWith3D heroVideoSrc={heroVideo} />

      <ProductGrid
        title="Latest Drop"
        products={latestProducts}
        ctaHref="/products?category=t-shirts"
      />

      <VideoBanner />

      <ProductGrid title="More From EVRYDAE" products={moreProducts} ctaHref="/products" />
    </>
  );
}
