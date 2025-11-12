// src/components/Footer.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

const shippingMessages = [
  "Shipping Worldwide",
  "Asantials Express Dispatch",
  "Track Your Order 24/7",
  "Complimentary Pick-Ups For Returns",
  "Exclusive Online Drops",
];

const BrandStory = () => {
  const [expanded, setExpanded] = useState(false);

  const detailSections = [
    {
      heading: "The Story",
      paragraphs: [
        "EVRYDAE was born from that frustration - and a mission to rebuild the everyday wardrobe from the fabric up.",
        "We discovered the answer in bamboo cotton - nature's most underrated luxury fiber. Softer than conventional cotton, naturally breathable, and thermoregulating, it moves with you, not against you. Every thread feels calm, cool, and clean - made to be worn every damn day.",
      ],
    },
    {
      heading: "Why Bamboo?",
      paragraphs: [
        "Because quality shouldn't be seasonal.",
        "Bamboo fabric lasts longer, feels smoother, and leaves a lighter footprint on the planet.",
        "It's sustainable luxury - not a gimmick, but a mindset.",
        "Our tees aren't built to shout. They're built to stay. To become your everyday armor - minimal, elevated, essential.",
      ],
    },
    {
      heading: "The Vision",
      paragraphs: [
        "EVRYDAE stands for balance - between comfort and style, function and emotion, street and sophistication.",
        "We're redefining what \"basics\" mean in India: not cheap, not common - but crafted, considered, and timeless.",
        "EVRYDAE | Made for those who demand more - even from the simplest things.",
      ],
    },
  ];

  return (
    <section className="border-t border-neutral-200 bg-neutral-100 text-neutral-900">
      <div className="site-shell section-gap">
        <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">
          VRYDAE | Elevated Essentials
        </p>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-neutral-700">
          <p>India's fashion scene has evolved fast - but something essential was missing.</p>
          <p>
            Between fast fashion and luxury hype, quality basics were forgotten. The market overflowed with
            cotton tees that looked premium on launch day but lost their soul after two washes.
          </p>
        </div>
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-6 text-[11px] uppercase tracking-[0.3em] text-neutral-700 underline decoration-neutral-400 underline-offset-4 transition hover:text-neutral-900"
          >
            Read More...
          </button>
        )}
        {expanded && (
          <div className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-700">
            {detailSections.map((section) => (
              <article key={section.heading}>
                <p className="font-header text-xs uppercase tracking-[0.35em] text-neutral-500">
                  {section.heading}
                </p>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={`${section.heading}-${index}`}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[11px] uppercase tracking-[0.3em] text-neutral-700 underline decoration-neutral-400 underline-offset-4 transition hover:text-neutral-900"
            >
              Read Less
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

const ShippingStripe = () => (
  <div className="w-full bg-neutral-900 text-white">
    <div className="site-shell py-3">
      <div className="shipping-marquee">
        <div className="shipping-marquee__track">
          {shippingMessages.map((message) => (
            <span key={message} className="shipping-marquee__item">
              {message}
            </span>
          ))}
          {shippingMessages.map((message) => (
            <span
              key={`${message}-duplicate`}
              className="shipping-marquee__item"
              aria-hidden="true"
            >
              {message}
            </span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SiteFooter = () => (
  <footer className="border-t border-neutral-200 bg-white">
    <div className="site-shell max-w-7xl lg:px-8">
      <div className="grid grid-cols-1 gap-10 py-12 md:grid-cols-3">
        {/* Column: Company */}
        <div className="text-sm text-neutral-700">
          <div className="mb-3 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            Company
          </div>
          <ul className="space-y-2">
            <li>
              <Link to="/story" className="hover:underline">
                Story
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:underline">
                Contact Us
              </Link>
            </li>
            <li>
              <Link to="/collaborations" className="hover:underline">
                Collaborations
              </Link>
            </li>
            <li>
              <Link to="/blogs" className="hover:underline">
                Blogs
              </Link>
            </li>
          </ul>
        </div>

        {/* Column: Help */}
        <div className="text-sm text-neutral-700">
          <div className="mb-3 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            Help
          </div>
          <ul className="space-y-2">
            <li>
              <Link to="/login" className="hover:underline">
                Members Login
              </Link>
            </li>
            <li>
              <Link to="/policy" className="hover:underline">
                Exchange/Returns Policy
              </Link>
            </li>
            <li>
              <Link to="/faq" className="hover:underline">
                FAQ
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:underline">
                Terms
              </Link>
            </li>
            <li>
              <Link to="/shipping" className="hover:underline">
                Shipping
              </Link>
            </li>
          </ul>
        </div>

        {/* Column: Connect */}
        <div className="text-sm text-neutral-700">
          <div className="mb-3 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            Connect
          </div>
          <div className="flex gap-4">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Instagram
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              YouTube
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              LinkedIn
            </a>
          </div>
          <p className="mt-6 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            © 2025 Asantials Retail Private Limited. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>

    <div className="bg-neutral-900 py-2 text-center text-[10px] uppercase tracking-[0.4em] text-white">
      Connect
    </div>
  </footer>
);

const Footer = () => (
  <>
    <BrandStory />
    <ShippingStripe />
    <SiteFooter />
  </>
);

export default Footer;
