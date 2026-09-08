"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Movie {
  vid: string;
  title: string;
  image: string;
  duration: string;
  sourceUrl: string;
  year: number | null;
}

interface CategoryClientProps {
  slug: string;
  nameAr: string;
  initialMovies: Movie[];
  initialTotalPages: number;
  initialPage: number;
}

export default function CategoryClient({
  slug,
  nameAr,
  initialMovies,
  initialTotalPages,
  initialPage,
}: CategoryClientProps) {
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const fetchMovies = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/movies?category=${slug}&page=${page}`);
        const data = await res.json();
        if (data.success) {
          setMovies(data.data.movies);
          setTotalPages(data.data.totalPages);
          setCurrentPage(page);
          // Update URL without full navigation
          const url = page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`;
          window.history.replaceState({}, "", url);
        }
      } catch (error) {
        console.error("Error fetching movies:", error);
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  const handlePageChange = (page: number) => {
    fetchMovies(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleImageError = (vid: string) => {
    setImageErrors((prev) => new Set(prev).add(vid));
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>الرئيسية</span>
          </button>

          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
            <div className="bg-[#e50914] rounded-lg p-1">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 4l2 4h-3l-2-4h2zm-4 0l2 4h-3l-2-4h2zm-4 0l2 4H9L7 4h2zm-4 0l2 4H5L3 4h2zM3 8h18v12a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
              </svg>
            </div>
            <span className="font-bold text-lg">
              سينما<span className="text-[#e50914]">فlix</span>
            </span>
          </div>

          <div className="w-20" />
        </div>
      </header>

      {/* Category Title */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <span className="w-1 h-8 bg-[#e50914] rounded-full" />
            {nameAr}
            <span className="text-sm font-normal text-gray-500">
              صفحة {currentPage} من {totalPages}
            </span>
          </h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton aspect-[2/3] rounded-xl bg-[#1a1a1a]" />
                <div className="mt-2 skeleton h-4 rounded-lg w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Movies Grid */}
        {!loading && movies.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {movies.map((movie) => (
              <div
                key={movie.vid}
                className="movie-card cursor-pointer group"
                onClick={() => router.push(`/movie/${movie.vid}`)}
              >
                <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-[#1a1a1a]">
                  {!imageErrors.has(movie.vid) && movie.image ? (
                    <Image
                      src={movie.image}
                      alt={movie.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-contain"
                      onError={() => handleImageError(movie.vid)}
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                      <svg className="w-10 h-10 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18 4l2 4h-3l-2-4h2zm-4 0l2 4h-3l-2-4h2zm-4 0l2 4H9L7 4h2zm-4 0l2 4H5L3 4h2zM3 8h18v12a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
                      </svg>
                    </div>
                  )}
                  <div className="movie-overlay absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-2 sm:p-3">
                    <div className="flex items-center gap-1.5">
                      <div className="bg-[#e50914] rounded-full p-1">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <span className="text-[10px] text-gray-300">مشاهدة</span>
                    </div>
                  </div>
                  {movie.duration && (
                    <span className="absolute top-1.5 left-1.5 bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded-md font-medium">
                      {movie.duration}
                    </span>
                  )}
                  <span className="absolute top-1.5 right-1.5 bg-[#e50914]/90 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                    HD
                  </span>
                  {movie.year && (
                    <span className="absolute bottom-1.5 left-1.5 bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded-md font-medium">
                      {movie.year}
                    </span>
                  )}
                </div>
                <h3 className="mt-1.5 text-xs sm:text-sm font-semibold text-white line-clamp-2 group-hover:text-[#e50914] transition-colors leading-relaxed">
                  {movie.title}
                </h3>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && movies.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">لا توجد أفلام في هذا التصنيف حالياً</p>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-10 mb-6">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-xl bg-[#282828] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#383838] transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {getPageNumbers().map((page, index) =>
              typeof page === "string" ? (
                <span key={`dots-${index}`} className="px-2 text-gray-400">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`min-w-[40px] h-10 rounded-xl text-sm font-medium transition-all ${
                    currentPage === page
                      ? "bg-[#e50914] text-white shadow-lg shadow-[#e50914]/30"
                      : "bg-[#282828] text-gray-300 hover:bg-[#383838] hover:text-white"
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-xl bg-[#282828] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#383838] transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/5 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-gray-600 text-xs">جميع الأفلام محفوظة الحقوق لمصادرها الأصلية</p>
        </div>
      </footer>
    </div>
  );
}
