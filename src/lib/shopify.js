const domain = import.meta.env.VITE_SHOPIFY_DOMAIN;
const token = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN;
const apiVersion = import.meta.env.VITE_SHOPIFY_API_VERSION || "2024-07";
const endpoint = `https://${domain}/api/${apiVersion}/graphql.json`;

async function graphql(query, variables = {}) {
  if (!domain || !token) {
    throw new Error(
      "Missing Shopify env: VITE_SHOPIFY_DOMAIN or VITE_SHOPIFY_STOREFRONT_TOKEN"
    );
  }

  let res, text, json;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    console.error("Network error calling Shopify:", e);
    throw e;
  }

  try {
    text = await res.text();
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Non-JSON response (${res.status}): ${String(text).slice(0, 300)}`
    );
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

/* ================= SHARED HELPERS ================= */

const defaultLanguage = import.meta.env.VITE_SHOPIFY_LANGUAGE || "en-US";

const fallbackCurrency = (countryCode) => {
  switch (countryCode) {
    case "IN":
      return "INR";
    case "GB":
      return "GBP";
    case "EU":
      return "EUR";
    default:
      return "USD";
  }
};

const defaultCurrencyCode =
  import.meta.env.VITE_SHOPIFY_CURRENCY ||
  fallbackCurrency((import.meta.env.VITE_SHOPIFY_COUNTRY || "US").toUpperCase());

const parseAmount = (amount) => {
  if (amount == null) return 0;
  const numeric = Number.parseFloat(Array.isArray(amount) ? amount[0] : amount);
  return Number.isFinite(numeric) ? numeric : 0;
};

export function formatMoney(
  amount,
  currencyCode = defaultCurrencyCode,
  locale = defaultLanguage,
) {
  const value = parseAmount(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode || defaultCurrencyCode,
      currencyDisplay: "symbol",
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currencyCode || defaultCurrencyCode} ${value.toFixed(2)}`;
  }
}

const hiddenKeywords = ["shoe", "shoes", "sneaker", "footwear", "boot", "boots", "sandal"];

const shouldHideProductNode = (node) => {
  if (!node) return false;

  const casefold = (value) => String(value ?? "").toLowerCase();

  const handle = casefold(node.handle);
  const title = casefold(node.title);
  const type = casefold(node.productType);

  const tags = Array.isArray(node.tags)
    ? node.tags.map((tag) => casefold(tag))
    : [];

  const haystacks = [handle, title, type, ...tags];
  return haystacks.some((value) =>
    hiddenKeywords.some((keyword) => value.includes(keyword)),
  );
};

const filterVisibleNodes = (nodes = []) =>
  nodes.filter((node) => !shouldHideProductNode(node));

const shouldHideCollectionNode = (node) => {
  if (!node) return false;
  const casefold = (value) => String(value ?? "").toLowerCase();
  const handle = casefold(node.handle);
  const title = casefold(node.title);
  return hiddenKeywords.some(
    (keyword) => handle.includes(keyword) || title.includes(keyword),
  );
};

const normaliseImage = (image, fallbackAlt = "") => {
  if (!image?.url) return null;
  return {
    url: image.url,
    alt: image.altText || fallbackAlt || "",
  };
};

export const extractOptionValues = (product, optionName) => {
  if (!product?.options?.length) return [];
  const target = optionName?.toLowerCase();
  const option = product.options.find(
    (opt) => opt?.name?.toLowerCase() === target,
  );
  return option?.values ?? [];
};

export function normalizeProductNode(node) {
  if (!node) return null;
  if (shouldHideProductNode(node)) return null;

  const price = parseAmount(node.priceRange?.minVariantPrice?.amount);
  const currencyCode =
    node.priceRange?.minVariantPrice?.currencyCode || defaultCurrencyCode;

  const images =
    node.images?.nodes
      ?.map((img) => normaliseImage(img, node.title))
      ?.filter(Boolean) ?? [];

  const featuredImage =
    normaliseImage(node.featuredImage, node.title) ?? images[0] ?? null;

  const variants =
    node.variants?.nodes?.map((variant) => ({
      id: variant.id,
      title: variant.title,
      availableForSale: Boolean(variant.availableForSale),
      sku: variant.sku ?? null,
      quantityAvailable: variant.quantityAvailable ?? null,
      price: parseAmount(variant.price?.amount ?? price),
      currencyCode: variant.price?.currencyCode || currencyCode,
      selectedOptions:
        variant.selectedOptions?.map((opt) => ({
          name: opt?.name ?? "",
          value: opt?.value ?? "",
        })) ?? [],
    })) ?? [];

  const collections =
    node.collections?.nodes?.map((collection) => ({
      id: collection?.id ?? null,
      handle: collection?.handle ?? "",
      title: collection?.title ?? "",
    })) ?? [];

  const optionLookup = {};
  (node.options ?? []).forEach((option) => {
    if (!option?.name) return;
    optionLookup[option.name.toLowerCase()] = option.values ?? [];
  });

  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    vendor: node.vendor ?? "",
    productType: node.productType ?? "",
    description: node.description ?? "",
    descriptionHtml: node.descriptionHtml ?? "",
    tags: node.tags ?? [],
    featuredImage,
    images,
    price,
    currencyCode,
    priceRange: node.priceRange ?? null,
    variants,
    options: node.options ?? [],
    optionValues: optionLookup,
    collections,
    metafields: node.metafields ?? [],
    seo: node.seo ?? null,
  };
}

export function toProductCard(product) {
  if (!product) return null;
  const image =
    product.featuredImage?.url ?? product.images?.[0]?.url ?? undefined;
  const secondaryImage =
    product.images?.find((img) => img?.url && img.url !== image)?.url ?? null;
  const currency = product.currencyCode || defaultCurrencyCode;
  return {
    title: product.title,
    price: formatMoney(product.price, currency),
    img: image,
    hoverImg: secondaryImage,
    badge: product.tags?.includes("new") ? "New" : undefined,
    href: `/product/${product.handle}`,
  };
}

const mapCollectionNode = (node) => {
  if (!node) return null;
  if (shouldHideCollectionNode(node)) return null;
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    image: normaliseImage(node.image, node.title),
    description: node.description ?? "",
  };
};

export const normaliseTokenValue = (value) =>
  value?.toString().trim().toLowerCase() ?? '';

export function findVariantForSize(product, size) {
  const variants = product?.variants ?? [];
  if (!variants.length) return null;

  if (!size) {
    return variants[0] ?? null;
  }

  const target = normaliseTokenValue(size);

  const matchByOption = variants.find((variant) =>
    variant.selectedOptions?.some(
      (option) =>
        normaliseTokenValue(option?.name) === 'size' &&
        normaliseTokenValue(option?.value) === target,
    ),
  );

  if (matchByOption) return matchByOption;

  return (
    variants.find((variant) => {
      const title = normaliseTokenValue(variant?.title);
      if (title && title === target) return true;
      const tokens =
        variant?.title
          ?.toLowerCase()
          ?.split('/')
          ?.map((token) => token.trim()) ?? [];
      return tokens.includes(target);
    }) ?? variants[0]
  );
}

export const getProductImageUrl = (product) =>
  product?.featuredImage?.url ?? product?.images?.[0]?.url ?? '';

/* ================= NAVIGATION ================= */

const defaultMenuItems = [
  { id: "all-products", label: "All Products", to: "/products", kind: "all" },
  {
    id: "collection-t-shirts",
    label: "T-Shirts",
    to: "/products?category=t-shirts",
    handle: "t-shirts",
    kind: "collection",
  },
  {
    id: "collection-hoodies",
    label: "Hoodies",
    to: "/products?category=hoodies",
    handle: "hoodies",
    kind: "collection",
  },
];

const escapedShopDomain = domain
  ? domain.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  : null;
const shopDomainRegex = escapedShopDomain
  ? new RegExp(`^https?://(?:www\\.)?${escapedShopDomain}`, "i")
  : /^https?:\/\/[^/]+/i;

function mapMenuUrl(url) {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;

  let pathname = raw;
  let search = "";
  let hostMatchesDomain = false;

  try {
    const parsed = new URL(
      raw,
      domain ? `https://${domain}` : "https://example.com"
    );
    pathname = parsed.pathname || "/";
    search = parsed.search || "";
    if (/^https?:\/\//i.test(raw)) {
      hostMatchesDomain =
        !domain || parsed.host === domain || parsed.host === `www.${domain}`;
    } else if (shopDomainRegex.test(raw)) {
      hostMatchesDomain = true;
    } else {
      hostMatchesDomain = true;
    }
  } catch {
    if (!raw.startsWith("/")) {
      return raw;
    }
    pathname = raw;
    search = "";
    hostMatchesDomain = true;
  }

  const normalized = `${pathname}${search}`;

  if (hostMatchesDomain) {
    if (pathname.startsWith("/collections/")) {
      const parts = pathname.split("/");
      const handle = parts[2]?.split("?")[0];
      if (handle && handle !== "all") {
        return `/products?category=${handle}`;
      }
      return "/products";
    }

    if (pathname.startsWith("/products/")) {
      const parts = pathname.split("/");
      const handle = parts[2]?.split("?")[0];
      if (handle) {
        return `/product/${handle}`;
      }
    }
  }

  return normalized;
}

function mapMenuItems(items = []) {
  return items
    .map((item, index) => {
      const id = item?.id || `menu-${index}`;
      const label = String(item?.title || "").trim() || "Menu Item";
      const resource = item?.resource;

      if (resource?.__typename === "Collection" && resource.handle) {
        return {
          id,
          label,
          to: `/products?category=${resource.handle}`,
          handle: resource.handle,
          kind: "collection",
        };
      }

      if (resource?.__typename === "Product" && resource.handle) {
        return {
          id,
          label,
          to: `/product/${resource.handle}`,
          handle: resource.handle,
          kind: "product",
        };
      }

      const resolved = mapMenuUrl(item?.url);
      if (!resolved) return null;

      const isExternal = /^(?:https?:|mailto:|tel:)/i.test(resolved);

      return {
        id,
        label,
        to: resolved,
        kind: isExternal ? "external" : "link",
        external: isExternal,
      };
    })
    .filter(Boolean);
}

const NAVIGATION_QUERY = `#graphql
  query NavigationMenu($handle: String!) {
    menu(handle: $handle) {
      items {
        id
        title
        url
        resource {
          __typename
          ... on Collection { handle }
          ... on Product { handle }
        }
      }
    }
  }
`;

export function getDefaultMenuItems() {
  return defaultMenuItems.map((item) => ({ ...item }));
}

export async function fetchNavigationMenu(handle = null) {
  const menuHandle =
    handle ?? import.meta.env.VITE_SHOPIFY_NAV_MENU_HANDLE ?? "main-menu";

  if (!menuHandle) {
    return getDefaultMenuItems();
  }

  try {
    const data = await graphql(NAVIGATION_QUERY, { handle: menuHandle });
    const items = mapMenuItems(data?.menu?.items || []);

    if (!items.length) {
      return getDefaultMenuItems();
    }

    const includesAll = items.some((item) => item.kind === "all");
    if (!includesAll) {
      const defaults = getDefaultMenuItems();
      return [defaults[0], ...items];
    }

    return items;
  } catch (error) {
    console.error(`Failed to fetch Shopify menu "${menuHandle}"`, error);
    return getDefaultMenuItems();
  }
}

/* ================= COLLECTIONS & PRODUCTS ================= */

const ALL_PRODUCTS_QUERY = `#graphql
  query AllProducts($limit: Int!) {
    products(first: $limit, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        handle
        title
        description
        descriptionHtml
        vendor
        productType
        tags
        featuredImage { url altText }
        images(first: 12) { nodes { url altText } }
        priceRange {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        options { name values }
        variants(first: 100) {
          nodes {
            id
            title
            availableForSale
            sku
            price { amount currencyCode }
            selectedOptions { name value }
          }
        }
        collections(first: 10) { nodes { id handle title } }
      }
    }
  }
`;

export async function fetchAllProducts(limit = 100) {
  const data = await graphql(ALL_PRODUCTS_QUERY, { limit });
  const nodes = filterVisibleNodes(data?.products?.nodes ?? []);
  return nodes.map(normalizeProductNode).filter(Boolean);
}

export async function fetchCollections(limit = 8) {
  const q = `#graphql
  query Collections($limit:Int!) {
    collections(first:$limit, sortKey:UPDATED_AT) {
      nodes {
        id
        handle
        title
        description
        image { url altText }
        products(first:1){ nodes { featuredImage { url altText } } }
      }
    }
  }`;
  const data = await graphql(q, { limit });
  const nodes = data?.collections?.nodes ?? [];
  return nodes.map(mapCollectionNode).filter(Boolean);
}

export async function fetchCollectionByHandle(handle, limit = 24) {
  const q = `#graphql
  query Collection($handle:String!, $limit:Int!) {
    collection(handle:$handle) {
      id
      title
      handle
      description
      image { url altText }
      products(first:$limit) {
        nodes {
          id
          handle
          title
          description
          descriptionHtml
          vendor
          productType
          featuredImage { url altText }
          images(first: 12) { nodes { url altText } }
          priceRange { minVariantPrice { amount currencyCode } }
          tags
          options { name values }
          variants(first: 50) {
            nodes {
              id
              availableForSale
              selectedOptions { name value }
              price { amount currencyCode }
              sku
            }
          }
          collections(first: 5) { nodes { id handle title } }
        }
      }
    }
  }`;
  const data = await graphql(q, { handle, limit });
  const collection = data?.collection;
  if (!collection) return null;
  const mapped = mapCollectionNode(collection);
  if (!mapped) return null;
  return {
    ...mapped,
    products:
      collection.products?.nodes
        ?.map(normalizeProductNode)
        ?.filter(Boolean) ?? [],
  };
}

export async function fetchProductByHandle(handle) {
  const q = `#graphql
  query ($handle:String!) {
    product(handle:$handle) {
      id
      handle
      title
      vendor
      productType
      description
      descriptionHtml

      featuredImage { url altText }
      images(first: 10) { nodes { url altText } }
      collections(first: 5) { nodes { id handle title } }

      priceRange { minVariantPrice { amount currencyCode } }

      options { name values }

      variants(first:20) {
        nodes {
          id
          title
          availableForSale
          sku
          selectedOptions { name value }
          price { amount currencyCode }
        }
      }

      metafield(namespace:"reviews", key:"json") { value }

      metafields(identifiers: [
        { namespace: "custom",  key: "subheading" },
        { namespace: "custom",  key: "subtitle" },
        { namespace: "custom",  key: "sub_title" },
        { namespace: "custom",  key: "sub-heading" },
        { namespace: "custom",  key: "tagline" },

        { namespace: "details", key: "subheading" },
        { namespace: "details", key: "subtitle" },
        { namespace: "details", key: "sub_title" },
        { namespace: "details", key: "sub-heading" },
        { namespace: "details", key: "tagline" },

        { namespace: "info",    key: "subheading" },
        { namespace: "info",    key: "subtitle" },
        { namespace: "info",    key: "sub_title" },
        { namespace: "info",    key: "sub-heading" },
        { namespace: "info",    key: "tagline" },

        { namespace: "global",  key: "subheading" },
        { namespace: "global",  key: "subtitle" },
        { namespace: "global",  key: "sub_title" },
        { namespace: "global",  key: "sub-heading" },
        { namespace: "global",  key: "tagline" },

        { namespace: "theme",   key: "subheading" },
        { namespace: "theme",   key: "subtitle" },
        { namespace: "theme",   key: "sub_title" },
        { namespace: "theme",   key: "sub-heading" },
        { namespace: "theme",   key: "tagline" },

        { namespace: "custom",  key: "materials" },
        { namespace: "custom",  key: "material" },
        { namespace: "custom",  key: "fabric_weight" },
        { namespace: "custom",  key: "weight" },
        { namespace: "custom",  key: "care" },
        { namespace: "custom",  key: "wash_care" },
        { namespace: "custom",  key: "shipping" },
        { namespace: "custom",  key: "size_chart_json" },
        { namespace: "custom",  key: "size_chart" },

        { namespace: "details", key: "materials" },
        { namespace: "details", key: "material" },
        { namespace: "details", key: "sole" },
        { namespace: "details", key: "lining" },
        { namespace: "details", key: "colour" },
        { namespace: "details", key: "color" },
        { namespace: "details", key: "type_of_shoe" }
      ]) {
        key
        namespace
        type
        value
        reference {
          __typename
          ... on MediaImage { image { url altText } }
          ... on GenericFile { url }
        }
      }

      seo { description }
      tags
      vendor
    }
  }`;
  const data = await graphql(q, { handle });
  return normalizeProductNode(data?.product ?? null);
}

export function getSubheadingFromProduct(product) {
  if (!product) return null;
  const metas = Array.isArray(product.metafields) ? product.metafields : [];

  const wantedKeys = new Set([
    "subheading",
    "subtitle",
    "sub_title",
    "sub-heading",
    "tagline",
  ]);
  const allowedNS = new Set(["custom", "details", "info", "global", "theme"]);

  const strip = (s = "") =>
    String(s).replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();

  const isPlaceholder = (s = "") =>
    /^(sub[-\s]?heading|subtitle|sub[-\s]?title|tagline)$/i.test(strip(s));

  const normalize = (val) => {
    const raw = String(val || "").trim();
    if (!raw || isPlaceholder(raw)) return null;
    return /<\/?[a-z][\s\S]*>/i.test(raw) ? { html: raw } : { text: raw };
  };

  for (const m of metas) {
    const key = String(m?.key || "").toLowerCase();
    const ns = String(m?.namespace || "").toLowerCase();
    if (wantedKeys.has(key) && allowedNS.has(ns) && m?.value) {
      const out = normalize(m.value);
      if (out) return out;
    }
  }

  if (product.seo?.description && !isPlaceholder(product.seo.description)) {
    const out = normalize(product.seo.description);
    if (out) return out;
  }

  const plain = strip(product.descriptionHtml) || strip(product.description);
  if (plain) {
    const firstSentence = plain.split(/(?<=[.!?])\s+/)[0].slice(0, 160);
    if (!isPlaceholder(firstSentence)) return { text: firstSentence };
  }

  return null;
}

export async function searchProducts(query, limit = 20) {
  const q = `#graphql
  query Search($query:String!, $limit:Int!) {
    products(first:$limit, query:$query) {
      nodes {
        id
        handle
        title
        featuredImage { url altText }
        priceRange { minVariantPrice { amount currencyCode } }
        tags
      }
    }
  }`;
  const data = await graphql(q, { query, limit });
  return filterVisibleNodes(data?.products?.nodes || []);
}

/* ---------- FULL FIELDS (for cards & fallbacks) ---------- */
export async function searchProductsWithOptions(term, limit = 20) {
  const q = `#graphql
  query SearchWithOptions($query:String!, $limit:Int!) {
    products(first:$limit, query:$query) {
      nodes {
        id
        handle
        title
        productType
        description
        featuredImage { url altText }
        images(first: 10) { nodes { url altText } }
        priceRange { minVariantPrice { amount currencyCode } }
        options { name values }
        variants(first: 50) {
          nodes {
            id
            availableForSale
            selectedOptions { name value }
            price { amount currencyCode }
          }
        }
        tags
      }
    }
  }`;
  const data = await graphql(q, { query: term, limit });
  return filterVisibleNodes(data?.products?.nodes || []);
}

/* Tag helpers */
function buildTagQuery(tag) {
  const safe = String(tag ?? "").replace(/'/g, "\\'");
  return `tag:'${safe}'`;
}

export async function fetchProductsByTag(tag, limit = 20, withOptions = true) {
  const term = buildTagQuery(tag);
  return withOptions
    ? searchProductsWithOptions(term, limit)
    : searchProducts(term, limit);
}

/* ================= CART ================= */

export async function cartCreate(lines = []) {
  const q = `#graphql
  mutation($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }`;
  const input = {
    lines,
    buyerIdentity: {
      countryCode: (import.meta.env.VITE_SHOPIFY_COUNTRY || "US").toUpperCase(),
    },
  };
  const data = await graphql(q, { input });
  const errors = data?.cartCreate?.userErrors || [];
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }
  return data?.cartCreate?.cart || null;
}

export async function cartQuery(id) {
  const q = `#graphql
  query($id: ID!) {
    cart(id:$id) {
      id
      checkoutUrl
      totalQuantity
      cost {
        subtotalAmount { amount currencyCode }
        totalAmount { amount currencyCode }
      }
      lines(first: 100) {
        nodes {
          id
          quantity
          cost { totalAmount { amount currencyCode } }
          merchandise {
            __typename
            ... on ProductVariant {
              id
              title
              sku
              product { id handle title featuredImage { url altText } }
              price { amount currencyCode }
              selectedOptions { name value }
              availableForSale
            }
          }
        }
      }
    }
  }`;
  const data = await graphql(q, { id });
  return data?.cart || null;
}

export async function cartLinesAdd(cartId, lines) {
  const q = `#graphql
  mutation($cartId:ID!, $lines:[CartLineInput!]!){
    cartLinesAdd(cartId:$cartId, lines:$lines){
      cart{ id }
      userErrors{ field message }
    }
  }`;
  return (await graphql(q, { cartId, lines })).cartLinesAdd;
}

export async function cartLinesUpdate(cartId, lines) {
  const q = `#graphql
  mutation($cartId:ID!, $lines:[CartLineUpdateInput!]!){
    cartLinesUpdate(cartId:$cartId, lines:$lines){
      cart{ id }
      userErrors{ field message }
    }
  }`;
  return (await graphql(q, { cartId, lines })).cartLinesUpdate;
}

export async function cartLinesRemove(cartId, lineIds) {
  const q = `#graphql
  mutation($cartId:ID!, $lineIds:[ID!]!){
    cartLinesRemove(cartId:$cartId, lineIds:$lineIds){
      cart{ id }
      userErrors{ field message }
    }
  }`;
  return (await graphql(q, { cartId, lineIds })).cartLinesRemove;
}

export async function cartDiscountCodesUpdate(cartId, discountCodes) {
  const q = `#graphql
  mutation($cartId:ID!, $discountCodes:[String!]!]{
    cartDiscountCodesUpdate(cartId:$cartId, discountCodes:$discountCodes){
      cart{ id }
      userErrors{ field message }
    }
  }`;
  return (await graphql(q, { cartId, discountCodes })).cartDiscountCodesUpdate;
}

/* ================= CUSTOMERS (AUTH) ================= */

export async function customerCreate({ email, password, firstName, lastName }) {
  const q = `#graphql
  mutation customerCreate($input: CustomerCreateInput!) {
    customerCreate(input:$input) {
      customer { id }
      userErrors { field message }
    }
  }`;
  return graphql(q, { input: { email, password, firstName, lastName } });
}

export async function customerAccessTokenCreate({ email, password }) {
  const q = `#graphql
  mutation($input:CustomerAccessTokenCreateInput!){
    customerAccessTokenCreate(input:$input){
      customerAccessToken { accessToken expiresAt }
      userErrors { field message }
    }
  }`;
  return graphql(q, { input: { email, password } });
}

export async function customerQuery(accessToken) {
  const q = `#graphql
  query($token:String!){
    customer(customerAccessToken:$token){
      id
      firstName
      lastName
      email
    }
  }`;
  return graphql(q, { token: accessToken });
}

export async function customerAccessTokenDelete(accessToken) {
  const q = `#graphql
  mutation customerAccessTokenDelete($accessToken: String!) {
    customerAccessTokenDelete(customerAccessToken: $accessToken) {
      deletedAccessToken
      deletedCustomerAccessTokenId
      userErrors { field message }
    }
  }`;
  return graphql(q, { accessToken });
}

/* ================= HELPERS FOR DYNAMIC SECTIONS ================= */

export async function fetchProductsFromCollection(handle, limit = 12) {
  const q = `#graphql
  query($handle:String!, $limit:Int!) {
    collection(handle:$handle) {
      id
      title
      handle
      products(first:$limit) {
        nodes {
          id
          handle
          title
          featuredImage { url altText }
          priceRange { minVariantPrice { amount currencyCode } }
          tags
        }
      }
    }
  }`;
  const res = await graphql(q, { handle, limit });
  return filterVisibleNodes(res.collection?.products?.nodes || []);
}

/* ---------- Robust tag search & fallbacks (ICONS THAT LAST) ---------- */
export async function fetchTriptychProducts(limit = 12) {
  const term = [
    "tag:'icons'",
    "tag:'icon'",
    'tag:"icons-that-last"',
    'tag:"icons that last"',
  ].join(" OR ");

  let items = await searchProductsWithOptions(term, limit);

  if (!items || items.length < limit) {
    items = await fetchProductsByTag("featured", limit, true);
  }
  if (!items || items.length < limit) {
    try {
      let pool = await fetchProductsFromCollection("frontpage", limit * 2);
      if (!pool || pool.length === 0) {
        const cols = await listCollections(5);
        for (const c of cols || []) {
          pool = await fetchProductsFromCollection(c.handle, limit * 2);
          if (pool && pool.length) break;
        }
      }
      items = pool?.slice(0, limit) || [];
    } catch {
      items = [];
    }
  }
  return items || [];
}

/* ---------- Robust get-the-look search + fallback ---------- */
export async function fetchGetTheLook(limit = 2) {
  const term = ["tag:'get-the-look'", "tag:'get the look'", "tag:'look'"].join(
    " OR "
  );
  let items = await searchProductsWithOptions(term, limit);

  if (!items || items.length < limit) {
    items = await fetchProductsByTag("featured", limit, true);
  }
  if (!items || items.length < limit) {
    try {
      let pool = await fetchProductsFromCollection("frontpage", limit * 3);
      if (!pool || pool.length === 0) {
        const cols = await listCollections(5);
        for (const c of cols || []) {
          pool = await fetchProductsFromCollection(c.handle, limit * 3);
          if (pool && pool.length) break;
        }
      }
      items = pool?.slice(0, limit) || [];
    } catch {
      items = [];
    }
  }
  return items || [];
}

export async function fetchGalleryProducts(limit = 12) {
  let items = await fetchProductsByTag("gallery", limit, true);
  if (!items || items.length === 0) {
    items = await fetchProductsByTag("featured", limit, true);
  }
  return items || [];
}

/* ================= VALUE SLIDES (METAOBJECTS) ================= */

export async function fetchValueSlides(limit = 4, type = "value_slide") {
  const q = `#graphql
  query ValueSlides($limit:Int!, $type:String!) {
    metaobjects(first: $limit, type: $type) {
      nodes {
        id
        handle
        title: field(key: "title") { value }
        body:  field(key: "body")  { value }
        image: field(key: "image") {
          value
          reference {
            __typename
            ... on MediaImage { image { url altText } }
            ... on GenericFile { url }
          }
        }
      }
    }
  }`;

  const data = await graphql(q, { limit, type });
  const nodes = data?.metaobjects?.nodes || [];

  return nodes.map((n) => {
    const ref = n?.image?.reference;
    let imgUrl = "";
    let altText = "";

    if (ref?.__typename === "MediaImage") {
      imgUrl = ref?.image?.url || "";
      altText = ref?.image?.altText || "";
    } else if (ref?.__typename === "GenericFile") {
      imgUrl = ref?.url || "";
    }

    if (!imgUrl) {
      const v = n?.image?.value || "";
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        imgUrl = v;
      }
    }

    return {
      id: n.id,
      key: n.handle || n.id,
      title: n?.title?.value || "",
      body: n?.body?.value || "",
      img: imgUrl,
      alt: altText,
    };
  });
}

/* ================= BLOGS ================= */

export async function fetchBlogs(limit = 10) {
  const q = `#graphql
  query Blogs($limit: Int!) {
    blogs(first: $limit) {
      edges {
        node {
          id
          handle
          title
          articles(first: 1) {
            edges {
              node {
                title
                excerptHtml
                image { url altText }
              }
            }
          }
        }
      }
    }
  }`;
  const data = await graphql(q, { limit });
  return data?.blogs?.edges ?? [];
}

export async function fetchBlogByHandle(handle, postsLimit = 50) {
  const q = `#graphql
  query BlogByHandle($handle: String!, $postsLimit: Int!) {
    blog(handle: $handle) {
      id
      title
      handle
      articles(first: $postsLimit) {
        nodes {
          id
          title
          handle
          publishedAt
          excerptHtml
          contentHtml
          image { url altText }
        }
      }
    }
  }`;
  try {
    const data = await graphql(q, { handle, postsLimit });
    return data?.blog ?? null;
  } catch (error) {
    console.error(`Error in fetchBlogByHandle("${handle}")`, error);
    return null;
  }
}

export async function fetchArticlesFromBlog(blogHandle, limit = 10) {
  const q = `#graphql
  query ArticlesFromBlog($blogHandle: String!, $limit: Int!) {
    blog(handle: $blogHandle) {
      articles(first: $limit) {
        edges {
          node {
            id
            title
            handle
            publishedAt
            excerptHtml
            featuredImage: image { url altText }
            linked_product: metafield(namespace: "custom", key: "linked_product") {
              reference { ... on Product { handle } }
            }
          }
        }
      }
    }
  }`;
  try {
    const data = await graphql(q, { blogHandle, limit });
    return data?.blog?.articles?.edges || [];
  } catch (error) {
    console.error("Error fetching articles:", error);
    return [];
  }
}

/* ================= RECOMMENDATIONS & PAGINATION ================= */

export async function fetchRecommendedProducts(productId, limit = 8) {
  const q = `#graphql
  query($productId: ID!) {
    productRecommendations(productId: $productId) {
      id
      handle
      title
      featuredImage { url altText }
      priceRange { minVariantPrice { amount currencyCode } }
      tags
    }
  }`;
  const data = await graphql(q, { productId });
  const items = filterVisibleNodes(data.productRecommendations || []);
  return items.slice(0, limit);
}

export async function searchProductsPage(query, limit = 24, after = null) {
  const q = `#graphql
  query SearchPage($query:String!, $limit:Int!, $after:String) {
    products(first:$limit, query:$query, after:$after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        featuredImage { url altText }
        images(first: 2) { nodes { url altText } }
        priceRange { minVariantPrice { amount currencyCode } }
        options { name values }
        tags
      }
    }
  }`;
  const data = await graphql(q, { query, limit, after });
  const edge = data?.products;
  return {
    nodes: filterVisibleNodes(edge?.nodes || []),
    endCursor: edge?.pageInfo?.endCursor || null,
    hasNextPage: !!edge?.pageInfo?.hasNextPage,
  };
}

export async function collectionProductsPage(
  handle,
  limit = 24,
  after = null
) {
  const q = `#graphql
  query CollectionPage($handle:String!, $limit:Int!, $after:String) {
    collection(handle:$handle) {
      products(first:$limit, after:$after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          handle
          title
          featuredImage { url altText }
          images(first: 2) { nodes { url altText } }
          priceRange { minVariantPrice { amount currencyCode } }
          options { name values }
          tags
        }
      }
    }
  }`;
  const data = await graphql(q, { handle, limit, after });
  const edge = data?.collection?.products;
  return {
    nodes: filterVisibleNodes(edge?.nodes || []),
    endCursor: edge?.pageInfo?.endCursor || null,
    hasNextPage: !!edge?.pageInfo?.hasNextPage,
  };
}

/** ================= INIT & COLLECTION HELPERS ================= **/

export const shopifyRuntime = {
  initialized: false,
  lastInitAt: 0,
  env: { domain, apiVersion, endpoint },
  collections: [],
  errors: [],
};

export async function listCollectionsPage(
  first = 50,
  after = null,
  sortKey = "TITLE"
) {
  const q = `#graphql
  query ListCollections($first: Int!, $after: String, $sortKey: CollectionSortKeys) {
    collections(first: $first, after: $after, sortKey: $sortKey) {
      pageInfo { hasNextPage endCursor }
      nodes { id handle title image { url altText } }
    }
  }`;
  const data = await graphql(q, { first, after, sortKey });
  const conn = data?.collections;
  return {
    nodes: conn?.nodes || [],
    endCursor: conn?.pageInfo?.endCursor || null,
    hasNextPage: !!conn?.pageInfo?.hasNextPage,
  };
}

export async function listCollections(first = 50) {
  const page = await listCollectionsPage(first, null, "TITLE");
  return page.nodes;
}

export async function listAllCollections(
  max = 250,
  pageSize = 50,
  sortKey = "TITLE"
) {
  const out = [];
  let after = null;
  while (out.length < max) {
    const { nodes, endCursor, hasNextPage } = await listCollectionsPage(
      Math.min(pageSize, max - out.length),
      after,
      sortKey
    );
    out.push(...nodes);
    if (!hasNextPage || !endCursor) break;
    after = endCursor;
  }
  return out;
}

export async function initShopify(options = {}) {
  const {
    preloadCollections = true,
    collectionsLimit = 100,
    sortKey = "TITLE",
    reload = false,
  } = options;

  if (!domain || !token) {
    const err = new Error(
      "Missing Shopify env: VITE_SHOPIFY_DOMAIN or VITE_SHOPIFY_STOREFRONT_TOKEN"
    );
    shopifyRuntime.errors.push(err);
    throw err;
  }

  if (shopifyRuntime.initialized && !reload) {
    return shopifyRuntime;
  }

  try {
    if (preloadCollections) {
      shopifyRuntime.collections = await listAllCollections(
        collectionsLimit,
        50,
        sortKey
      );
    }
    shopifyRuntime.initialized = true;
    shopifyRuntime.lastInitAt = Date.now();
  } catch (e) {
    console.warn("initShopify: preload failed", e);
    shopifyRuntime.errors.push(e);
    shopifyRuntime.initialized = true;
    shopifyRuntime.lastInitAt = Date.now();
  }

  return shopifyRuntime;
}

export const init = initShopify;

export function getInitState() {
  return shopifyRuntime;
}

/* ================= DEEP SEARCH ================= */

export async function searchProductsDeep(query, limit = 24) {
  const q = `#graphql
  query SearchDeep($query:String!, $limit:Int!) {
    products(first:$limit, query:$query) {
      nodes {
        id
        handle
        title
        publishedAt
        featuredImage { url altText }
        priceRange { minVariantPrice { amount currencyCode } }
        tags
        variants(first: 50) {
          nodes {
            id
            availableForSale
            selectedOptions { name value }
            price { amount currencyCode }
          }
        }
      }
    }
  }`;
  const data = await graphql(q, { query, limit });
  return filterVisibleNodes(data?.products?.nodes || []);
}
