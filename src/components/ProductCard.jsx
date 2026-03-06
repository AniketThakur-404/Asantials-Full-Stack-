import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function ProductCard({ item }) {
  const { img, hoverImg, title, price, badge, href } = item;
  const primarySrc = img || hoverImg || null;
  const [currentSrc, setCurrentSrc] = useState(primarySrc);
  const [imageFailed, setImageFailed] = useState(!primarySrc);

  useEffect(() => {
    const nextSrc = img || hoverImg || null;
    setCurrentSrc(nextSrc);
    setImageFailed(!nextSrc);
  }, [img, hoverImg]);

  const handleImageError = () => {
    if (hoverImg && currentSrc !== hoverImg) {
      setCurrentSrc(hoverImg);
      return;
    }
    setImageFailed(true);
  };

  const showHover =
    Boolean(img && hoverImg && hoverImg !== img) && !imageFailed && currentSrc === img;

  const card = (
    <article className="group flex h-full flex-col transition hover:-translate-y-1">
      <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
        {currentSrc && !imageFailed ? (
          <>
            <img
              src={currentSrc}
              alt={title}
              className={`h-full w-full object-fill transition duration-500 group-hover:scale-[1.03] ${showHover ? 'group-hover:opacity-0' : ''
                }`}
              loading="lazy"
              onError={handleImageError}
            />
            {showHover && (
              <img
                src={hoverImg}
                alt={`${title} alternate view`}
                className="absolute inset-0 h-full w-full object-fill opacity-0 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                loading="lazy"
                onError={handleImageError}
              />
            )}
          </>
        ) : (
          <div className="relative h-full w-full bg-neutral-200">
            <div className="absolute left-3 top-3 text-[10px] uppercase tracking-[0.28em] text-neutral-600">
              {title || "Product"}
            </div>
          </div>
        )}
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-neutral-900 px-3 py-1 text-[10px] tracking-[0.25em] text-white uppercase">
            {badge}
          </span>
        )}
      </div>

      <div className="px-2 pt-4">
        <div className="space-y-1">
          <h3 className="text-[10px] uppercase leading-4 tracking-[0.28em] text-neutral-900">
            {title}
          </h3>
          {price && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              {price}
            </p>
          )}
        </div>
      </div>
    </article>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      >
        {card}
      </Link>
    );
  }

  return card;
}
