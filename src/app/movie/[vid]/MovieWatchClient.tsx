"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import VideoPlayer from "./VideoPlayer";

interface MovieWatchClientProps {
  vid: string;
}

interface MovieDetail {
  vid: string;
  title: string;
  description: string;
  image: string;
  embedUrl: string;
  sourceUrl: string;
}

interface RelatedMovie {
  vid: string;
  title: string;
  image: string;
  duration: string;
}

export default function MovieWatchClient({ vid }: MovieWatchClientProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedMovies, setRelatedMovies] = useState<RelatedMovie[]>([]);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/movie-detail?vid=${vid}`);
        const data = await res.json();
        if (data.success) {
          setDetail(data.data);
        }
      } catch (err) {
        console.error("Error fetching detail:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchRelated = async () => {
      try {
        const res = await fetch(`/api/movies?category=arabic-movies&page=1`);
        const data = await res.json();
        if (data.success) {
          setRelatedMovies(
            data.data.movies
              .filter((m: RelatedMovie) => m.vid !== vid)
              .slice(0, 10)
          );
        }
      } catch (err) {
        console.error("Error fetching related:", err);
      }
    };

    fetchDetail();
    fetchRelated();
  }, [vid]);

  // Extract year from title
  const yearMatch = detail?.title?.match(/\((\d{4})\)/);
  const year = yearMatch ? yearMatch[1] : "";

  // Extract clean title — strip source branding
  const cleanTitle = detail?.title
    ?.replace(/كيو فيلم/g, "")
    .replace(/\s*[-–—]\s*$/g, "")
    .replace(/مشاهدة فيلم/g, "")
    .replace(/HD اون لاين/g, "")
    .replace(/مترجم/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>العودة للرئيسية</span>
          </button>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <div className="bg-[#e50914] rounded-lg p-1">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M18 4l2 4h-3l-2-4h2zm-4 0l2 4h-3l-2-4h2zm-4 0l2 4H9L7 4h2zm-4 0l2 4H5L3 4h2zM3 8h18v12a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
              </svg>
            </div>
            <span className="font-bold text-lg">
              سينما<span className="text-[#e50914]">فlix</span>
            </span>
          </div>

          <div className="w-24" />
        </div>
      </div>

      {/* Video Player Section — our own ad-free player */}
      <div ref={playerRef} className="w-full bg-black">
        <div className="max-w-6xl mx-auto">
          <VideoPlayer vid={vid} title={detail?.title || "مشغل الفيلم"} />
        </div>
      </div>

      {/* Movie Info Section */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            <div className="skeleton h-8 rounded-lg w-2/3" />
            <div className="skeleton h-4 rounded-lg w-full" />
            <div className="skeleton h-4 rounded-lg w-3/4" />
          </div>
        ) : (
          <>
            {/* Title and Meta */}
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
                {cleanTitle || detail?.title || "فيلم"}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                {year && (
                  <span className="bg-[#383838] text-gray-300 px-3 py-1 rounded-lg text-sm flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {year}
                  </span>
                )}
                <span className="bg-[#e50914]/20 text-[#e50914] px-3 py-1 rounded-lg text-sm font-bold">
                  HD
                </span>
                <span className="bg-[#f5b301]/20 text-[#f5b301] px-3 py-1 rounded-lg text-sm font-bold">
                  أفلام عربي
                </span>
              </div>
            </div>

            {/* Description */}
            {detail?.description && (
              <div className="bg-[#181818]/80 rounded-2xl border border-white/5 p-5 mb-8">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-[#e50914]"
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
                  القصة
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {detail.description}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Related Movies */}
      {relatedMovies.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-12">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-5 flex items-center gap-3">
            <span className="w-1 h-7 bg-[#e50914] rounded-full" />
            أفلام مشابهة
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {relatedMovies.map((movie) => (
              <RelatedMovieCard key={movie.vid} movie={movie} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-gray-500 text-sm">
            جميع الأفلام محفوظة الحقوق لمصادرها الأصلية
          </p>
        </div>
      </footer>
    </div>
  );
}

function RelatedMovieCard({ movie }: { movie: RelatedMovie }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="movie-card cursor-pointer group"
      onClick={() => router.push(`/movie/${movie.vid}`)}
    >
      <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-[#1a1a1a]">
        {!imgError ? (
          <Image
            src={movie.image}
            alt={movie.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
            className="object-contain"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#383838]">
            <svg
              className="w-10 h-10 text-gray-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18 4l2 4h-3l-2-4h2zm-4 0l2 4h-3l-2-4h2zm-4 0l2 4H9L7 4h2zm-4 0l2 4H5L3 4h2zM3 8h18v12a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
            </svg>
          </div>
        )}
        <div className="movie-overlay absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3">
          <div className="flex items-center gap-2">
            <div className="bg-[#e50914] rounded-full p-1.5">
              <svg
                className="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-xs text-gray-300">مشاهدة</span>
          </div>
        </div>
        {movie.duration && (
          <span className="absolute top-2 left-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
            {movie.duration}
          </span>
        )}
        <span className="absolute top-2 right-2 bg-[#e50914]/90 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold">
          HD
        </span>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-white line-clamp-2 group-hover:text-[#e50914] transition-colors">
        {movie.title}
      </h3>
    </div>
  );
}
