"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Movie {
  vid: string;
  title: string;
  image: string;
  duration: string;
  sourceUrl: string;
}

interface CategoryRow {
  slug: string;
  name: string;
  nameAr: string;
  movies: Movie[];
}

interface Category {
  slug: string;
  name: string;
  nameAr: string;
}

interface HomeClientProps {
  categoryRows: CategoryRow[];
  allCategories: Category[];
}

export default function HomeClient({
  categoryRows,
  allCategories,
}: HomeClientProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [heroIndex, setHeroIndex] = useState(0);

  // Get all movies from all categories for search
  const allMovies = categoryRows.flatMap((r) => r.movies);
  const uniqueMovies = allMovies.filter(
    (m, i, arr) => arr.findIndex((x) => x.vid === m.vid) === i
  );

  // Featured movies for hero (pick from first category with movies)
  const heroMovies = categoryRows[0]?.movies.slice(0, 5) || [];

  // Auto-rotate hero
  useEffect(() => {
    if (heroMovies.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroMovies.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [heroMovies.length]);

  // Search results
  const searchResults = searchQuery
    ? uniqueMovies.filter((m) =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleMovieClick = (vid: string) => {
    router.push(`/movie/${vid}`);
  };

  const handleImageError = (vid: string) => {
    setImageErrors((prev) => new Set(prev).add(vid));
  };

  const heroMovie = heroMovies[heroIndex];

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* ===== HEADER ===== */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-[#e50914] rounded-lg p-1.5 shadow-lg shadow-[#e50914]/20">
                <svg
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 4l2 4h-3l-2-4h2zm-4 0l2 4h-3l-2-4h2zm-4 0l2 4H9L7 4h2zm-4 0l2 4H5L3 4h2zM3 8h18v12a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
                </svg>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                سينما<span className="text-[#e50914]">فlix</span>
              </h1>
            </div>

            {/* Nav links - desktop */}
            <nav className="hidden md:flex items-center gap-6">
              <span className="text-white font-semibold text-sm border-b-2 border-[#e50914] pb-0.5">
                الرئيسية
              </span>
              {allCategories.slice(0, 6).map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => router.push(`/category/${cat.slug}`)}
                  className="text-gray-300 hover:text-white text-sm transition-colors"
                >
                  {cat.nameAr}
                </button>
              ))}
              <button
                onClick={() => setShowMenu(true)}
                className="text-gray-300 hover:text-white text-sm transition-colors"
              >
                المزيد
              </button>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Search toggle */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="text-white hover:text-[#e50914] transition-colors p-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>

              {/* Mobile menu */}
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="md:hidden text-white p-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Search bar (expandable) */}
          {showSearch && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="relative max-w-2xl mx-auto">
                <input
                  type="text"
                  placeholder="ابحث عن فيلم أو مسلسل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-[#282828]/90 backdrop-blur-md border border-white/20 rounded-2xl py-3 px-5 pr-12 text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914]/50 focus:ring-2 focus:ring-[#e50914]/20 transition-all text-sm"
                />
                <svg
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ===== CATEGORY MENU OVERLAY ===== */}
      {showMenu && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="absolute top-0 right-0 h-full w-72 sm:w-80 bg-[#181818] border-l border-white/5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">التصنيفات</h3>
                <button
                  onClick={() => setShowMenu(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="space-y-1">
                {allCategories.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => {
                      setShowMenu(false);
                      router.push(`/category/${cat.slug}`);
                    }}
                    className="w-full text-right px-3 py-2.5 rounded-xl text-gray-300 hover:bg-[#282828] hover:text-white transition-all text-sm"
                  >
                    {cat.nameAr}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SEARCH RESULTS OVERLAY ===== */}
      {showSearch && searchQuery && (
        <div className="fixed inset-0 z-[55] pt-20 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <h2 className="text-lg font-bold text-white mb-4">
              نتائج البحث عن &ldquo;{searchQuery}&rdquo; ({searchResults.length})
            </h2>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {searchResults.map((movie) => (
                  <MovieCard
                    key={movie.vid}
                    movie={movie}
                    onClick={() => {
                      handleMovieClick(movie.vid);
                      setShowSearch(false);
                      setSearchQuery("");
                    }}
                    hasError={imageErrors.has(movie.vid)}
                    onError={() => handleImageError(movie.vid)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-12">
                لا توجد نتائج
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===== HERO SECTION ===== */}
      {heroMovie && (
        <section className="relative h-[85vh] sm:h-[80vh] md:h-[90vh] overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0">
            {!imageErrors.has(heroMovie.vid) && heroMovie.image ? (
              <Image
                src={heroMovie.image}
                alt={heroMovie.title}
                fill
                className="object-cover"
                unoptimized
                priority
                onError={() => handleImageError(heroMovie.vid)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a0a0a] via-[#141414] to-[#0a0a1a]" />
            )}
          </div>

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#141414]/80" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#141414] to-transparent" />

          {/* Hero content */}
          <div className="absolute bottom-[15%] sm:bottom-[20%] right-0 left-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="max-w-xl">
                {/* Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#e50914] text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded">
                    جديد
                  </span>
                  <span className="bg-white/10 backdrop-blur-sm text-white text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded">
                    HD
                  </span>
                  {heroMovie.duration && (
                    <span className="bg-white/10 backdrop-blur-sm text-white text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded">
                      {heroMovie.duration}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-4 drop-shadow-2xl">
                  {heroMovie.title
                    .replace(/فيلم /g, "")
                    .replace(/مشاهدة /g, "")}
                </h2>

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleMovieClick(heroMovie.vid)}
                    className="bg-[#e50914] hover:bg-[#b20710] text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all hover:shadow-xl hover:shadow-[#e50914]/30 flex items-center gap-2"
                  >
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    مشاهدة الآن
                  </button>
                  <button
                    onClick={() => handleMovieClick(heroMovie.vid)}
                    className="bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base transition-all flex items-center gap-2 border border-white/10"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    التفاصيل
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Hero dots */}
          {heroMovies.length > 1 && (
            <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
              {heroMovies.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`transition-all duration-300 rounded-full ${
                    i === heroIndex
                      ? "w-8 h-2 bg-[#e50914]"
                      : "w-2 h-2 bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== CATEGORY ROWS ===== */}
      <div className="relative z-10 -mt-20 sm:-mt-16">
        {categoryRows.map((cat) => (
          <CategoryRowSection
            key={cat.slug}
            category={cat}
            onMovieClick={handleMovieClick}
            imageErrors={imageErrors}
            onImageError={handleImageError}
          />
        ))}
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="mt-16 border-t border-white/5 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-[#e50914] rounded-lg p-1">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 4l2 4h-3l-2-4h2zm-4 0l2 4h-3l-2-4h2zm-4 0l2 4H9L7 4h2zm-4 0l2 4H5L3 4h2zM3 8h18v12a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
                  </svg>
                </div>
                <span className="font-bold text-white">
                  سينما<span className="text-[#e50914]">فlix</span>
                </span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">
                مشاهدة وتحميل أحدث الأفلام بجودة عالية HD اون لاين
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">أقسام الأفلام</h4>
              <div className="space-y-1.5">
                {allCategories.slice(0, 6).map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => router.push(`/category/${cat.slug}`)}
                    className="block text-gray-500 hover:text-gray-300 text-xs transition-colors"
                  >
                    {cat.nameAr}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">المزيد</h4>
              <div className="space-y-1.5">
                {allCategories.slice(6, 12).map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => router.push(`/category/${cat.slug}`)}
                    className="block text-gray-500 hover:text-gray-300 text-xs transition-colors"
                  >
                    {cat.nameAr}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">روابط</h4>
              <div className="space-y-1.5">
              <span className="block text-gray-500 text-xs">
                جميع الحقوق محفوظة لمصادرها
              </span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 text-center">
            <p className="text-gray-600 text-xs">
              جميع الأفلام محفوظة الحقوق لمصادرها الأصلية © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ===== MOVIE CARD COMPONENT ===== */
function MovieCard({
  movie,
  onClick,
  hasError,
  onError,
}: {
  movie: Movie;
  onClick: () => void;
  hasError: boolean;
  onError: () => void;
}) {
  return (
    <div className="movie-card cursor-pointer group" onClick={onClick}>
      <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-[#1a1a1a]">
        {!hasError && movie.image ? (
          <Image
            src={movie.image}
            alt={movie.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
            className="object-contain"
            onError={onError}
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
            <svg
              className="w-10 h-10 text-gray-600"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18 4l2 4h-3l-2-4h2zm-4 0l2 4h-3l-2-4h2zm-4 0l2 4H9L7 4h2zm-4 0l2 4H5L3 4h2zM3 8h18v12a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
            </svg>
          </div>
        )}
        <div className="movie-overlay absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-2 sm:p-3">
          <div className="flex items-center gap-1.5">
            <div className="bg-[#e50914] rounded-full p-1">
              <svg
                className="w-3 h-3 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-[10px] sm:text-xs text-gray-300">مشاهدة</span>
          </div>
        </div>
        {movie.duration && (
          <span className="absolute top-1.5 left-1.5 bg-black/80 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-medium">
            {movie.duration}
          </span>
        )}
        <span className="absolute top-1.5 right-1.5 bg-[#e50914]/90 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-bold">
          HD
        </span>
      </div>
      <h3 className="mt-1.5 text-xs sm:text-sm font-semibold text-white line-clamp-2 group-hover:text-[#e50914] transition-colors leading-relaxed">
        {movie.title}
      </h3>
    </div>
  );
}

/* ===== CATEGORY ROW WITH HORIZONTAL SCROLL ===== */
function CategoryRowSection({
  category,
  onMovieClick,
  imageErrors,
  onImageError,
}: {
  category: CategoryRow;
  onMovieClick: (vid: string) => void;
  imageErrors: Set<string>;
  onImageError: (vid: string) => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "right" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="mb-8 sm:mb-10">
      {/* Row header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-3 flex items-center justify-between">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <span className="w-0.5 h-5 sm:h-6 bg-[#e50914] rounded-full" />
          {category.nameAr}
          <span className="text-xs font-normal text-gray-500 hidden sm:inline">
            ({category.movies.length} فيلم)
          </span>
        </h2>
        <button
          onClick={() => router.push(`/category/${category.slug}`)}
          className="text-gray-400 hover:text-[#e50914] text-xs sm:text-sm transition-colors flex items-center gap-1"
        >
          عرض الكل
          <svg
            className="w-3 h-3 sm:w-4 sm:h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Scrollable row */}
      <div className="relative group/row">
        {/* Left arrow (RTL: appears on right side visually) */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 z-10 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Right arrow (RTL: appears on left side visually) */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 z-10 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {category.movies.map((movie) => (
            <div
              key={movie.vid}
              className="shrink-0 w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px]"
              style={{ scrollSnapAlign: "start" }}
            >
              <MovieCard
                movie={movie}
                onClick={() => onMovieClick(movie.vid)}
                hasError={imageErrors.has(movie.vid)}
                onError={() => onImageError(movie.vid)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
