import React from "react";
import { Link } from "react-router-dom";

export default function ProductCard({ item }) {
  const { img, hoverImg, title, price, badge, href } = item;

  const card = (
    <article className="group flex h-full flex-col transition hover:-translate-y-1">
      <div className="relative aspect-[5/6] overflow-hidden bg-neutral-100">
        <img
          src={img}
          alt={title}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${
            hoverImg ? 'group-hover:opacity-0' : ''
          }`}
          loading="lazy"
        />
        {hoverImg && (
          <img
            src={hoverImg}
            alt={`${title} alternate view`}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
            loading="lazy"
          />
        )}
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-neutral-900 px-3 py-1 text-[10px] tracking-[0.25em] text-white uppercase">
            {badge}
          </span>
        )}
      </div>

      <div className="px-2 pt-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="flex-1 text-[10px] uppercase leading-4 tracking-[0.28em] text-neutral-900">
            {title}
          </h3>
          {price && (
            <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              {price}
            </span>
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
