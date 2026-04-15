import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import ProductPage from './ProductPage';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const NAVBAR_HEIGHT = 88;
const FEATURED_VISIBLE_COUNT = 5;
const FEATURED_CYCLE_MS = 3000;
const FEATURED_ANIMATION_MS = 520;

// ─── Utility ────────────────────────────────────────────────────────────────
function formatPrice(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ─── Cart Hook ───────────────────────────────────────────────────────────────
function useCart() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_cart') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('sf_cart', JSON.stringify(items));
  }, [items]);

  const add = useCallback((product) => {
    setItems(prev => {
      const found = prev.find(i => i.id === product.id);
      if (found) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
  }, []);

  const remove = useCallback((id) => setItems(prev => prev.filter(i => i.id !== id)), []);

  const update = useCallback((id, qty) => {
    if (qty < 1) { remove(id); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  }, [remove]);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.basePrice * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return { items, add, remove, update, clear, total, count };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Navbar({ cartCount, onCartOpen, searchTerm, onSearchChange, user, onAuthOpen, onSignOut, onProfileOpen }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-gray-950 shadow-2xl py-3' : 'bg-gray-950 py-4'
      }`}
    >
      <div className="w-full px-4 sm:px-6 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 0v6h10V5H5zm5 8a1 1 0 110 2 1 1 0 010-2z"/>
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-wide hidden sm:block">
            <span className="text-cyan-400">Tech</span>Store
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-auto relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search for phones, laptops, accessories…"
            className="w-full bg-gray-800 text-white placeholder-gray-400 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs text-gray-300">Hi, {user.name}</span>
              <button
                onClick={onProfileOpen}
                className="border border-cyan-700 hover:border-cyan-500 text-cyan-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Profile
              </button>
              <button
                onClick={onSignOut}
                className="border border-gray-700 hover:border-gray-500 text-gray-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onAuthOpen('signin')}
                className="border border-gray-700 hover:border-gray-500 text-gray-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => onAuthOpen('signup')}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Sign Up
              </button>
            </>
          )}
          <button
            onClick={onCartOpen}
            className="relative flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function AuthModal({ open, mode, onClose, onAuthSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setForm({ name: '', email: '', password: '', phone: '', address: '' });
      setSaving(false);
      setError('');
    }
  }, [open, mode]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'signup') {
        const { data } = await axios.post(`${API}/api/users`, {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          address: form.address,
        });
        onAuthSuccess(data);
      } else {
        const { data } = await axios.post(`${API}/api/users/login`, {
          email: form.email,
          password: form.password,
        });
        onAuthSuccess(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${mode === 'signup' ? 'sign up' : 'sign in'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-2xl modal-pop">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-xl">{mode === 'signup' ? 'Create Account' : 'Sign In'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        {mode === 'signup' && (
          <>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required placeholder="Full Name"
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Address"
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="Phone Number"
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </>
        )}
        <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
          required placeholder="Email"
          className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
        <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
          required placeholder="Password"
          className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors">
          {saving ? 'Please wait…' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

function HeroBanner({ promotions = [] }) {
  const defaultSlides = [
    {
      title: 'Latest Smartphones',
      subtitle: 'Explore the newest flagship phones with cutting-edge technology',
      badge: 'NEW ARRIVALS',
      gradient: 'from-blue-900 via-indigo-900 to-purple-900',
      accent: 'text-cyan-400',
      img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
    },
    {
      title: 'Premium Laptops',
      subtitle: 'Power meets portability - find the perfect laptop for work & play',
      badge: 'BEST SELLERS',
      gradient: 'from-gray-900 via-slate-800 to-gray-900',
      accent: 'text-emerald-400',
      img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
    },
    {
      title: 'Smart Accessories',
      subtitle: 'Complete your tech setup with our premium accessories collection',
      badge: 'EXCLUSIVE DEALS',
      gradient: 'from-purple-900 via-pink-900 to-rose-900',
      accent: 'text-pink-400',
      img: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&q=80',
    },
  ];

  const promoSlides = promotions.map((promo) => ({
    title: promo.campaignName,
    subtitle: `Special discount is live now. Use code ${promo.promoCode} to claim ${promo.discountPercentage}% off.`,
    badge: 'LIMITED OFFER',
    gradient: 'from-emerald-900 via-teal-900 to-cyan-900',
    accent: 'text-emerald-300',
    code: promo.promoCode,
    codeLabel: 'Use Code',
    discount: `${promo.discountPercentage}% OFF`,
    img: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=600&q=80',
  }));

  const pinnedDefaultSlides = defaultSlides.filter((slide) => (
    slide.title === 'Latest Smartphones' || slide.title === 'Premium Laptops'
  ));
  const slides = promoSlides.length > 0
    ? [...promoSlides, ...pinnedDefaultSlides]
    : defaultSlides;
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    setSlideIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const s = slides[slideIndex] || slides[0];

  return (
    <div className={`relative overflow-hidden bg-gradient-to-r ${s.gradient} transition-all duration-1000`} style={{ minHeight: '480px' }}>
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white blur-3xl"/>
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white blur-3xl"/>
      </div>
      <div className="relative w-full px-4 sm:px-6 py-16 md:py-20 flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1 text-center md:text-left md:min-h-[340px] flex flex-col md:justify-between">
          <span className={`inline-block text-xs font-bold tracking-widest ${s.accent} border border-current rounded-full px-3 py-1 mb-4 animate-pulse`}>
            {s.badge}
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4 transition-all duration-500 min-h-[3.25rem] md:min-h-[4.75rem] line-clamp-2">
            {s.title}
          </h1>
          <p className="text-gray-300 text-lg mb-8 max-w-md min-h-[4rem] md:min-h-[4.5rem] line-clamp-2">{s.subtitle}</p>
          <div className="flex flex-col items-center md:items-start gap-5">
            <div className="h-[126px] flex items-start justify-center md:justify-start">
              {s.code ? (
                <div className="w-fit rounded-2xl border border-emerald-400/40 bg-black/25 px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-emerald-200 tracking-widest">{s.codeLabel}</span>
                  <span className="block text-3xl md:text-4xl font-black text-emerald-300 tracking-wider">{s.code}</span>
                  {s.discount && <span className="text-xs font-semibold text-emerald-100">{s.discount}</span>}
                </div>
              ) : (
                <div className="w-fit rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-left opacity-0 pointer-events-none">
                  <span className="text-xs font-semibold tracking-widest">Use Code</span>
                  <span className="block text-3xl md:text-4xl font-black tracking-wider">CODE</span>
                  <span className="text-xs font-semibold">0% OFF</span>
                </div>
              )}
            </div>
            <button
              onClick={() => document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-8 py-4 rounded-2xl text-lg shadow-xl hover:shadow-cyan-500/25 transition-all duration-300 hover:-translate-y-1"
            >
              Shop Now ->
            </button>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <img
            src={s.img}
            alt={s.title}
            className="w-72 h-72 md:w-80 md:h-80 object-cover rounded-3xl shadow-2xl ring-1 ring-white/10 transition-all duration-700"
          />
        </div>
      </div>
    </div>
  );
}

function CategoryBar({ categories, active, onSelect, topOffset }) {
  const all = ['All', ...categories];
  return (
    <section className="w-full bg-gray-900 border-b border-gray-800 sticky z-40" style={{ top: `${topOffset}px` }}>
      <div className="w-full px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1 py-3 min-w-max">
          {all.map(cat => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                active === cat
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function PriceFilter({ minPrice, maxPrice, value, onChange }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-400 whitespace-nowrap">Price:</span>
      <input
        type="range"
        min={minPrice}
        max={maxPrice}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-32 accent-cyan-500"
      />
      <span className="text-white font-medium whitespace-nowrap">≤ {formatPrice(value)}</span>
    </div>
  );
}

function SortSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
    >
      <option value="default">Sort: Default</option>
      <option value="price_asc">Price: Low → High</option>
      <option value="price_desc">Price: High → Low</option>
      <option value="name_asc">Name: A → Z</option>
    </select>
  );
}

function ProductCard({ product, onAdd, onView, added, disableReveal = false }) {
  const [imgError, setImgError] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const availableStock = Number(product.availableStock ?? product.stockQuantity ?? 0);
  const outOfStock = availableStock <= 0;

  useEffect(() => {
    if (disableReveal) {
      setVisible(true);
      return undefined;
    }

    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disableReveal]);

  const isVisible = disableReveal || visible;

  return (
    <div
      ref={ref}
      onClick={() => onView(product)}
      className={`group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/15 transition-all duration-500 flex flex-col cursor-pointer ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-gray-800 aspect-square">
        {product.imageUrl && !imgError ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
            <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <span className="text-sm">No image</span>
          </div>
        )}
        <span className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur text-cyan-400 text-xs font-semibold px-2 py-1 rounded-md">
          {product.category}
        </span>
        <span className={`absolute top-3 right-3 text-white text-xs font-semibold px-2 py-1 rounded-md ${
          outOfStock ? 'bg-red-600/90' : 'bg-green-600/90'
        }`}>
          {outOfStock ? 'Out of Stock' : `In Stock (${availableStock})`}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-white font-semibold text-base leading-snug mb-3 line-clamp-2 min-h-[3rem] group-hover:text-cyan-400 transition-colors duration-200">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-cyan-400 font-black text-xl">{formatPrice(product.basePrice)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(product); }}
            disabled={outOfStock}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 ${
              outOfStock
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                :
              added
                ? 'bg-green-600 text-white scale-95'
                : 'bg-cyan-500 hover:bg-cyan-400 text-white hover:scale-105'
            }`}
          >
            {outOfStock ? (
              <>Out of Stock</>
            ) : added ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
                Added
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Add
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryCarouselRow({ title, products, onAdd, onView, recentlyAdded }) {
  if (!products.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h3 className="text-2xl font-black text-white">{title}</h3>
        <p className="text-xs text-gray-500">Drag or swipe to explore</p>
      </div>
      <div className="overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory pb-2">
        <div className="flex gap-5 min-w-max pr-4">
          {products.map(product => (
            <div key={product.id} className="snap-start w-[250px] sm:w-[270px] lg:w-[290px] flex-shrink-0">
              <ProductCard
                product={product}
                onAdd={onAdd}
                onView={onView}
                added={recentlyAdded.has(product.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function getRotatedSlice(products, startIndex, count) {
  if (!products.length || count <= 0) return [];
  const next = [];
  for (let i = 0; i < Math.min(count, products.length); i += 1) {
    next.push(products[(startIndex + i) % products.length]);
  }
  return next;
}

function getFeaturedVisibleCount(width) {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  return FEATURED_VISIBLE_COUNT;
}

function FeaturedCyclingRow({ title, products, onAdd, onView, recentlyAdded }) {
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(() => getFeaturedVisibleCount(typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [isSliding, setIsSliding] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);
  const [slideDistance, setSlideDistance] = useState(0);
  const firstSlotRef = useRef(null);
  const isCyclingEnabled = products.length > visibleCount;

  useEffect(() => {
    const updateVisibleCount = () => setVisibleCount(getFeaturedVisibleCount(window.innerWidth));
    window.addEventListener('resize', updateVisibleCount, { passive: true });
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  useEffect(() => {
    setStartIndex(0);
    setIsSliding(false);
    setDisableTransition(false);
  }, [products, visibleCount]);

  useEffect(() => {
    const updateSlideDistance = () => {
      if (!firstSlotRef.current) return;
      setSlideDistance(firstSlotRef.current.offsetWidth);
    };

    updateSlideDistance();
    window.addEventListener('resize', updateSlideDistance, { passive: true });
    return () => window.removeEventListener('resize', updateSlideDistance);
  }, [visibleCount, startIndex, products.length]);

  useEffect(() => {
    if (!isCyclingEnabled || slideDistance <= 0) return undefined;
    const timer = setInterval(() => {
      setIsSliding((prev) => (prev ? prev : true));
    }, FEATURED_CYCLE_MS);
    return () => clearInterval(timer);
  }, [isCyclingEnabled, slideDistance]);

  useEffect(() => {
    if (!isSliding || !isCyclingEnabled) return undefined;
    const timer = setTimeout(() => {
      setDisableTransition(true);
      setStartIndex((prev) => (prev + 1) % products.length);
      setIsSliding(false);
      requestAnimationFrame(() => {
        setDisableTransition(false);
      });
    }, FEATURED_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [isSliding, isCyclingEnabled, products.length]);

  if (!products.length) return null;

  const visibleProducts = getRotatedSlice(products, startIndex, visibleCount);
  const slidingTrack = getRotatedSlice(products, startIndex, visibleCount + 1);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h3 className="text-2xl font-black text-white">{title}</h3>
        <p className="text-xs text-gray-500">{isCyclingEnabled ? 'Auto-cycling every 3s' : 'Showing all products'}</p>
      </div>
      {!isCyclingEnabled ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {visibleProducts.map((product) => (
            <ProductCard
              key={`${title}-static-${product.id}`}
              product={product}
              onAdd={onAdd}
              onView={onView}
              added={recentlyAdded.has(product.id)}
              disableReveal
            />
          ))}
        </div>
      ) : (
        <div className="relative min-h-[22rem] overflow-hidden">
          <div
            className="flex -mx-2.5 transform-gpu will-change-transform"
            style={{
              transform: `translate3d(${isSliding ? -slideDistance : 0}px, 0, 0)`,
              transition: disableTransition ? 'none' : `transform ${FEATURED_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            {slidingTrack.map((product, index) => (
              <div
                key={`${title}-slot-${index}-${product.id}`}
                className="flex-shrink-0 px-2.5"
                style={{ width: `${100 / visibleCount}%` }}
                ref={index === 0 ? firstSlotRef : undefined}
              >
                <ProductCard
                  product={product}
                  onAdd={onAdd}
                  onView={onView}
                  added={recentlyAdded.has(product.id)}
                  disableReveal
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CartSidebar({ open, onClose, items, onUpdate, onRemove, onCheckout, total }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out modal-pop ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-xl">Your Cart</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              <p className="text-lg font-medium">Your cart is empty</p>
              <p className="text-sm text-center">Add some products to get started!</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex gap-3 bg-gray-900 rounded-xl p-3 border border-gray-800">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" onError={e => e.target.style.display='none'} />
                ) : (
                  <div className="w-16 h-16 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-600">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{item.name}</p>
                  <p className="text-cyan-400 text-sm font-bold">{formatPrice(item.basePrice)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => onUpdate(item.id, item.qty - 1)} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 text-white rounded-md flex items-center justify-center transition-colors">−</button>
                    <span className="text-white font-semibold text-sm w-6 text-center">{item.qty}</span>
                    <button onClick={() => onUpdate(item.id, item.qty + 1)} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 text-white rounded-md flex items-center justify-center transition-colors">+</button>
                    <button onClick={() => onRemove(item.id)} className="ml-auto text-red-400 hover:text-red-300 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-gray-800 space-y-4">
            <div className="flex justify-between text-white">
              <span className="text-gray-400">Subtotal</span>
              <span className="font-black text-xl text-cyan-400">{formatPrice(total)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 rounded-2xl text-lg shadow-xl hover:shadow-cyan-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Checkout →
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function CheckoutModal({ open, onClose, items, total, onSuccess, currentUser, onRequireAuth }) {
  const [step, setStep] = useState(1); // 1=details, 2=payment, 3=success
  const [form, setForm] = useState({ name: '', email: '', address: '', promoCode: '' });
  const [payment, setPayment] = useState({ cardNumber: '', expiry: '', cvv: '', name: '' });
  const [promoResult, setPromoResult] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [processing, setProcessing] = useState(false);

  const finalTotal = promoResult ? promoResult.discountedPrice : total;

  useEffect(() => {
    if (currentUser) {
      setForm(prev => ({
        ...prev,
        name: currentUser.name || prev.name,
        email: currentUser.email || prev.email,
        address: currentUser.address || prev.address,
      }));
    }
  }, [currentUser]);

  const reset = () => {
    setStep(1);
    setForm({ name: '', email: '', address: '', promoCode: '' });
    setPayment({ cardNumber: '', expiry: '', cvv: '', name: '' });
    setPromoResult(null);
    setPromoError('');
    setPaymentError('');
  };

  const applyPromo = async () => {
    if (!form.promoCode.trim()) return;
    setApplyingPromo(true); setPromoError(''); setPromoResult(null);
    try {
      const { data } = await axios.post(`${API}/api/promotions/apply`, { promoCode: form.promoCode.trim(), originalPrice: total });
      setPromoResult(data);
    } catch (err) {
      setPromoError(err.response?.data?.error || 'Invalid promo code');
    } finally { setApplyingPromo(false); }
  };

  const formatCard = (v) => v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
  const formatExpiry = (v) => { const d = v.replace(/\D/g, ''); return d.length >= 3 ? `${d.slice(0,2)}/${d.slice(2,4)}` : d; };

  const handlePay = async () => {
    if (!currentUser) {
      onRequireAuth('signin');
      return;
    }
    setProcessing(true);
    setPaymentError('');
    try {
      await axios.post(`${API}/api/orders`, {
        userId: currentUser.id,
        discountedTotal: promoResult ? finalTotal : null,
        items: items.map(item => ({
          productId: item.id,
          quantity: item.qty,
          price: item.basePrice,
        })),
      });
      setStep(3);
    } catch (err) {
      setPaymentError(err.response?.data?.error || 'Failed to place order');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => { onClose(); reset(); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose}/>
      <div className="relative bg-gray-950 border border-gray-800 rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto modal-pop">
        {/* Header */}
        <div className="sticky top-0 bg-gray-950 px-6 py-5 border-b border-gray-800 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400'}`}>1</span>
            <div className="w-8 h-0.5 bg-gray-700"/>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400'}`}>2</span>
            <div className="w-8 h-0.5 bg-gray-700"/>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>✓</span>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Step 1: Order Details */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-white font-bold text-2xl">Order Details</h2>
              {/* Order summary */}
              <div className="bg-gray-900 rounded-xl p-4 space-y-2 max-h-40 overflow-y-auto">
                {items.map(i => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-300">{i.name} × {i.qty}</span>
                    <span className="text-white font-medium">{formatPrice(i.basePrice * i.qty)}</span>
                  </div>
                ))}
              </div>

              {/* Promo code */}
              <div>
                <label className="text-gray-400 text-sm block mb-1">Promo Code</label>
                <div className="flex gap-2">
                  <input
                    value={form.promoCode}
                    onChange={e => setForm(f => ({ ...f, promoCode: e.target.value.toUpperCase() }))}
                    placeholder="Enter promo code"
                    className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    onClick={applyPromo}
                    disabled={applyingPromo}
                    className="bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {applyingPromo ? '…' : 'Apply'}
                  </button>
                </div>
                {promoError && <p className="text-red-400 text-xs mt-1">{promoError}</p>}
                {promoResult && (
                  <p className="text-green-400 text-xs mt-1">
                    🎉 {promoResult.discountPercentage}% off applied! You save {formatPrice(promoResult.discount)}
                  </p>
                )}
              </div>

              {/* Customer info */}
              {[
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'John Doe' },
                { key: 'email', label: 'Email Address', type: 'email', placeholder: 'john@example.com' },
                { key: 'address', label: 'Delivery Address', type: 'text', placeholder: '123 Main St, City, Country' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-gray-400 text-sm block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={!currentUser}
                  />
                </div>
              ))}
              {!currentUser && (
                <p className="text-amber-400 text-xs">
                  Please sign in or sign up before continuing checkout.
                </p>
              )}

              <div className="flex justify-between items-center pt-2">
                <div>
                  <p className="text-gray-400 text-sm">Total</p>
                  <p className="text-cyan-400 font-black text-2xl">{formatPrice(finalTotal)}</p>
                  {promoResult && <p className="text-gray-500 text-xs line-through">{formatPrice(total)}</p>}
                </div>
                <button
                  onClick={() => { if (currentUser && form.name && form.email && form.address) setStep(2); else if (!currentUser) onRequireAuth('signin'); }}
                  disabled={!currentUser || !form.name || !form.email || !form.address}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white font-bold px-8 py-3 rounded-2xl transition-all duration-200 hover:scale-105"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-white font-bold text-2xl">Payment</h2>
              <div className="bg-gray-900 border border-cyan-500/20 rounded-2xl p-4">
                <p className="text-cyan-400 text-xs font-semibold mb-3 tracking-wider">DEMO PAYMENT PORTAL</p>
                {/* Card preview */}
                <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl p-4 mb-4 border border-gray-600">
                  <div className="flex justify-between items-center mb-6">
                    <div className="w-10 h-7 bg-yellow-400/80 rounded flex items-center justify-center">
                      <span className="text-gray-900 text-xs font-black">VISA</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-5 h-5 rounded-full bg-red-500 opacity-80"/>
                      <div className="w-5 h-5 rounded-full bg-yellow-500 opacity-80 -ml-2"/>
                    </div>
                  </div>
                  <p className="text-white font-mono text-lg tracking-widest mb-3">
                    {payment.cardNumber || '•••• •••• •••• ••••'}
                  </p>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-gray-500 text-xs">CARD HOLDER</p>
                      <p className="text-white text-sm font-medium">{payment.name || 'YOUR NAME'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">EXPIRES</p>
                      <p className="text-white text-sm font-medium">{payment.expiry || 'MM/YY'}</p>
                    </div>
                  </div>
                </div>

                {/* Card fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Card Number</label>
                    <input
                      value={payment.cardNumber}
                      onChange={e => setPayment(p => ({ ...p, cardNumber: formatCard(e.target.value) }))}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Name on Card</label>
                    <input
                      value={payment.name}
                      onChange={e => setPayment(p => ({ ...p, name: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Expiry Date</label>
                      <input
                        value={payment.expiry}
                        onChange={e => setPayment(p => ({ ...p, expiry: formatExpiry(e.target.value) }))}
                        placeholder="MM/YY"
                        maxLength={5}
                        className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">CVV</label>
                      <input
                        value={payment.cvv}
                        onChange={e => setPayment(p => ({ ...p, cvv: e.target.value.replace(/\D/g,'').slice(0,3) }))}
                        placeholder="•••"
                        maxLength={3}
                        type="password"
                        className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 font-semibold py-3 rounded-2xl transition-colors">
                  ← Back
                </button>
                <button
                  onClick={handlePay}
                  disabled={processing || !payment.cardNumber || !payment.name || !payment.expiry || !payment.cvv}
                  className="flex-2 flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:opacity-40 text-white font-bold py-3 rounded-2xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Processing…
                    </>
                  ) : (
                    <>Pay {formatPrice(finalTotal)}</>
                  )}
                </button>
              </div>
              {paymentError && <p className="text-red-400 text-xs">{paymentError}</p>}
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <div>
                <h2 className="text-white font-black text-3xl mb-2">Order Placed!</h2>
                <p className="text-gray-400">Thank you, {form.name}! Your order has been confirmed.</p>
                <p className="text-gray-500 text-sm mt-1">A confirmation will be sent to {form.email}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-4 text-left space-y-2">
                <p className="text-gray-400 text-sm">Order Total: <span className="text-cyan-400 font-bold">{formatPrice(finalTotal)}</span></p>
                <p className="text-gray-400 text-sm">Delivery to: <span className="text-white">{form.address}</span></p>
                <p className="text-gray-400 text-sm">Estimated delivery: <span className="text-white">3-5 business days</span></p>
              </div>
              <button
                onClick={() => { onSuccess(); handleClose(); }}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-2xl text-lg transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/25"
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserProfileModal({ open, onClose, currentUser, onUserUpdate }) {
  const [tab, setTab] = useState('details');
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', address: '' });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '' });
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !currentUser) return;
    setProfile({
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      address: currentUser.address || '',
    });
    setPasswordForm({ oldPassword: '', newPassword: '' });
    setMessage('');
    setError('');
    setTab('details');
    setLoadingOrders(true);
    axios.get(`${API}/api/users/${currentUser.id}`)
      .then(({ data }) => setOrders(data.orders || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load order history'))
      .finally(() => setLoadingOrders(false));
  }, [open, currentUser]);

  if (!open || !currentUser) return null;

  const saveDetails = async (e) => {
    e.preventDefault();
    setSavingDetails(true);
    setError('');
    setMessage('');
    try {
      const { data } = await axios.put(`${API}/api/users/${currentUser.id}`, profile);
      onUserUpdate(data);
      setMessage('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingDetails(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setError('');
    setMessage('');
    try {
      const { data } = await axios.put(`${API}/api/users/${currentUser.id}/change-password`, passwordForm);
      setMessage(data.message || 'Password updated successfully');
      setPasswordForm({ oldPassword: '', newPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto modal-pop">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-xl">My Profile</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {[
              { key: 'details', label: 'Edit Details' },
              { key: 'password', label: 'Change Password' },
              { key: 'orders', label: 'Order History' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setMessage(''); setError(''); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t.key ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {message && <p className="text-green-400 text-sm">{message}</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {tab === 'details' && (
            <form onSubmit={saveDetails} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'name', label: 'Name', type: 'text', required: true },
                { key: 'email', label: 'Email', type: 'email', required: true },
                { key: 'phone', label: 'Phone', type: 'text', required: false },
                { key: 'address', label: 'Address', type: 'text', required: false },
              ].map(field => (
                <div key={field.key} className={field.key === 'address' ? 'sm:col-span-2' : ''}>
                  <label className="text-gray-400 text-sm block mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    required={field.required}
                    value={profile[field.key]}
                    onChange={e => setProfile(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <button
                  disabled={savingDetails}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl"
                >
                  {savingDetails ? 'Saving…' : 'Save Details'}
                </button>
              </div>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={changePassword} className="space-y-4 max-w-md">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Old Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.oldPassword}
                  onChange={e => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button
                disabled={savingPassword}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl"
              >
                {savingPassword ? 'Updating…' : 'Change Password'}
              </button>
            </form>
          )}

          {tab === 'orders' && (
            <div className="space-y-3">
              {loadingOrders ? (
                <p className="text-gray-400 text-sm">Loading orders…</p>
              ) : orders.length === 0 ? (
                <p className="text-gray-400 text-sm">You have not placed any orders yet.</p>
              ) : orders.map(order => (
                <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-white font-semibold">Order #{order.id}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-cyan-300">{order.status}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{new Date(order.orderDate).toLocaleString()}</p>
                  <p className="text-cyan-400 font-semibold">{formatPrice(order.discountedTotal ?? order.totalAmount)}</p>
                  <div className="text-sm text-gray-300">
                    {order.items.map(item => (
                      <p key={item.id}>{item.product?.name || `Product ${item.productId}`} × {item.quantity}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="w-full bg-gray-950 border-t border-gray-800 mt-20">
      <div className="w-full px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 0v6h10V5H5zm5 8a1 1 0 110 2 1 1 0 010-2z"/>
                </svg>
            </div>
            <span className="text-white font-bold text-lg"><span className="text-cyan-400">Tech</span>Store</span>
          </div>
          <p className="text-gray-500 text-sm">Your one-stop destination for the latest tech products, accessories, and gadgets.</p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Categories</h4>
          <ul className="space-y-2 text-gray-500 text-sm">
            {['Mobile Phones', 'Laptops', 'Accessories', 'Smart Devices', 'Audio'].map(c => (
              <li key={c} className="hover:text-cyan-400 cursor-pointer transition-colors">{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Customer Service</h4>
          <ul className="space-y-2 text-gray-500 text-sm">
            {['FAQs', 'Shipping Info', 'Returns & Refunds', 'Track Order', 'Contact Us'].map(c => (
              <li key={c} className="hover:text-cyan-400 cursor-pointer transition-colors">{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Contact</h4>
          <div className="space-y-2 text-gray-500 text-sm">
            <p>📞 +1 (555) 123-4567</p>
            <p>✉️ support@techstore.com</p>
            <p>📍 123 Tech Avenue, Silicon Valley</p>
          </div>
          <div className="flex gap-3 mt-4">
            {['facebook', 'twitter', 'instagram', 'youtube'].map(s => (
              <div key={s} className="w-8 h-8 bg-gray-800 hover:bg-cyan-500 rounded-lg flex items-center justify-center transition-colors cursor-pointer">
                <span className="text-gray-400 hover:text-white text-xs">{s[0].toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800 px-4 sm:px-6 py-4 text-center text-gray-600 text-xs">
        © {new Date().getFullYear()} TechStore. All rights reserved. | Demo Payment Portal – No real transactions.
      </div>
    </footer>
  );
}

// ─── Main StoreFront ──────────────────────────────────────────────────────────
export default function StoreFront() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState(new Set());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [currentUser, setCurrentUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [stockNotice, setStockNotice] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activePromotions, setActivePromotions] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);

  const { items: cartItems, add, remove, update, clear, total, count } = useCart();

  const maxPrice = products.reduce((m, p) => Math.max(m, p.basePrice), 0);
  const [priceLimit, setPriceLimit] = useState(0);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/products`),
      axios.get(`${API}/api/categories`).catch(() => ({ data: [] })),
    ])
      .then(([productsResponse, categoriesResponse]) => {
        const productData = productsResponse.data;
        setProducts(productData);
        setCatalogCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
        const max = productData.reduce((m, p) => Math.max(m, p.basePrice), 0);
        setPriceLimit(Math.ceil(max) || 10000);
      })
      .catch(() => setError('Failed to load products. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchActivePromotions = async () => {
      try {
        const { data } = await axios.get(`${API}/api/promotions/active`);
        if (mounted) {
          setActivePromotions(Array.isArray(data) ? data : []);
        }
      } catch {
        if (mounted) setActivePromotions([]);
      }
    };

    fetchActivePromotions();
    const timer = setInterval(fetchActivePromotions, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const categories = useMemo(() => {
    const fromProducts = products.map((p) => p.category).filter(Boolean);
    return [...new Set([...catalogCategories, ...fromProducts])].sort((a, b) => a.localeCompare(b));
  }, [catalogCategories, products]);

  useEffect(() => {
    if (activeCategory !== 'All' && !categories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [activeCategory, categories]);

  const filtered = products
    .filter(p => activeCategory === 'All' || p.category === activeCategory)
    .filter(p => {
      const q = searchTerm.toLowerCase();
      return !q || p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
    })
    .filter(p => p.basePrice <= priceLimit)
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.basePrice - b.basePrice;
      if (sortBy === 'price_desc') return b.basePrice - a.basePrice;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });

  const featuredCategories = useMemo(() => ([
    { title: 'Mobile Phones', aliases: ['mobile phones'] },
    { title: 'Laptops', aliases: ['laptops'] },
    { title: 'TV', aliases: ['tv', 'tvs'] },
  ]), []);

  const categoryRows = useMemo(() => {
    const normalizeCategory = (value) => (value || '').toLowerCase().trim();
    return featuredCategories
      .map(({ title, aliases }) => ({
        title,
        products: filtered.filter((p) => aliases.includes(normalizeCategory(p.category))),
      }))
      .filter(row => row.products.length > 0);
  }, [featuredCategories, filtered]);

  const handleAdd = (product) => {
    const availableStock = Number(product.availableStock ?? product.stockQuantity ?? 0);
    const currentInCart = cartItems.find(i => i.id === product.id);
    if (availableStock <= 0) {
      setStockNotice(`${product.name} is currently out of stock.`);
      setTimeout(() => setStockNotice(''), 2500);
      return;
    }
    if ((currentInCart?.qty || 0) >= availableStock) {
      setStockNotice(`${product.name} is out of stock for additional quantity.`);
      setTimeout(() => setStockNotice(''), 2500);
      return;
    }
    add(product);
    setRecentlyAdded(prev => new Set([...prev, product.id]));
    setTimeout(() => {
      setRecentlyAdded(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 1500);
  };

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('sf_user', JSON.stringify(user));
    if (user?.token) {
      localStorage.setItem('sf_token', user.token);
      axios.defaults.headers.common.Authorization = `Bearer ${user.token}`;
    }
    setAuthOpen(false);
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('sf_user');
    localStorage.removeItem('sf_token');
    delete axios.defaults.headers.common.Authorization;
    setProfileOpen(false);
  };

  const handleUserUpdate = (updatedUser) => {
    setCurrentUser((prev) => {
      const next = { ...prev, ...updatedUser, token: prev?.token || updatedUser?.token };
      localStorage.setItem('sf_user', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('sf_user') || 'null');
      const savedToken = localStorage.getItem('sf_token') || savedUser?.token;
      if (savedUser?.id) {
        setCurrentUser(savedUser);
      }
      if (savedToken) {
        axios.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
        localStorage.setItem('sf_token', savedToken);
      }
    } catch {
      localStorage.removeItem('sf_user');
      localStorage.removeItem('sf_token');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar
        cartCount={count}
        onCartOpen={() => setCartOpen(true)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        user={currentUser}
        onAuthOpen={openAuth}
        onSignOut={handleSignOut}
        onProfileOpen={() => setProfileOpen(true)}
      />

      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onAuthSuccess={handleAuthSuccess} />
      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} currentUser={currentUser} onUserUpdate={handleUserUpdate} />

      <main className="overflow-x-hidden">
        {/* Push content below fixed navbar */}
        <div className="h-[88px]"/>

        {selectedProduct ? (
          <ProductPage
            product={selectedProduct}
            user={currentUser}
            onAddToCart={handleAdd}
            added={recentlyAdded.has(selectedProduct.id)}
            onBack={() => setSelectedProduct(null)}
            onRequireAuth={openAuth}
          />
        ) : (
          <>
            <CategoryBar categories={categories} active={activeCategory} onSelect={setActiveCategory} topOffset={NAVBAR_HEIGHT} />

            <HeroBanner promotions={activePromotions} />

            {/* Products section */}
            <section id="products-section" className="w-full bg-gray-950">
              <div className="w-full px-4 sm:px-6 py-10">
              {/* Filters row */}
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-black text-2xl md:text-3xl">
                    {activeCategory === 'All' ? 'Featured Categories' : `${activeCategory} Picks`}
                    {filtered.length > 0 && <span className="text-gray-500 font-normal text-base ml-2">({filtered.length} products)</span>}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {maxPrice > 0 && (
                    <PriceFilter minPrice={0} maxPrice={Math.ceil(maxPrice)} value={priceLimit} onChange={setPriceLimit} />
                  )}
                  <SortSelect value={sortBy} onChange={setSortBy} />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-6 py-4 rounded-2xl mb-8 text-center">
                  {error}
                </div>
              )}
              {stockNotice && (
                <div className="bg-amber-900/30 border border-amber-500/50 text-amber-300 px-6 py-4 rounded-2xl mb-8 text-center">
                  {stockNotice}
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-gray-900 rounded-2xl overflow-hidden animate-pulse">
                      <div className="aspect-square bg-gray-800"/>
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-gray-800 rounded w-3/4"/>
                        <div className="h-3 bg-gray-800 rounded w-1/2"/>
                        <div className="h-8 bg-gray-800 rounded-xl"/>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && filtered.length === 0 && !error && (
                <div className="text-center py-20 space-y-4">
                  <div className="text-6xl">🔍</div>
                  <p className="text-gray-400 text-xl font-medium">No products found</p>
                  <p className="text-gray-600">Try adjusting your filters or search term</p>
                  <button onClick={() => { setActiveCategory('All'); setSearchTerm(''); setPriceLimit(Math.ceil(maxPrice) || 10000); }}
                    className="bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                    Clear Filters
                  </button>
                </div>
              )}

              {/* Featured cycling rows for home, normal grid for category pages */}
              {!loading && filtered.length > 0 && activeCategory === 'All' && (
                <div className="space-y-10">
                  {categoryRows.map(row => (
                    <FeaturedCyclingRow
                      key={row.title}
                      title={row.title}
                      products={row.products}
                      onAdd={handleAdd}
                      onView={setSelectedProduct}
                      recentlyAdded={recentlyAdded}
                    />
                  ))}
                </div>
              )}

              {!loading && filtered.length > 0 && activeCategory !== 'All' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  {filtered.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAdd={handleAdd}
                      onView={setSelectedProduct}
                      added={recentlyAdded.has(product.id)}
                    />
                  ))}
                </div>
              )}
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />

      <CartSidebar
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdate={update}
        onRemove={remove}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
        total={total}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cartItems}
        total={total}
        onSuccess={clear}
        currentUser={currentUser}
        onRequireAuth={openAuth}
      />
    </div>
  );
}
