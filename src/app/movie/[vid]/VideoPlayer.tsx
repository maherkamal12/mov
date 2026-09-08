"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Source {
  server: string;
  label: string;
  url: string;
  type: "mp4" | "hls";
}

interface VideoPlayerProps {
  vid: string;
  title: string;
}

export default function VideoPlayer({ vid, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sources, setSources] = useState<Source[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player state
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showServers, setShowServers] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [buffering, setBuffering] = useState(false);
  const [progressHover, setProgressHover] = useState<number | null>(null);

  // Load the clean source list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/video-sources?vid=${vid}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data.sources?.length) {
          setSources(data.data.sources);
          setActiveIndex(0);
        } else {
          setError("لم يتم العثور على مصدر تشغيل لهذا الفيلم");
        }
      } catch {
        if (!cancelled) setError("حدث خطأ أثناء تحميل الفيلم");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vid]);

  // Attach the active source to the <video> element
  useEffect(() => {
    const video = videoRef.current;
    const source = sources[activeIndex];
    if (!video || !source) return;

    // Tear down any previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setError(null);
    setBuffering(true);

    const startPlayback = () => {
      video.play().catch(() => setPlaying(false));
    };

    if (source.type === "hls") {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari plays HLS natively
        video.src = source.url;
        startPlayback();
      } else {
        // Load hls.js dynamically so it stays out of the initial bundle
        import("hls.js")
          .then(({ default: Hls }) => {
            if (!Hls.isSupported()) {
              video.src = source.url;
              startPlayback();
              return;
            }
            const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
            hlsRef.current = hls;
            hls.loadSource(source.url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (data.fatal) setError("تعذر تشغيل هذا السيرفر، جرّب سيرفر آخر");
            });
          })
          .catch(() => setError("تعذر تحميل مشغل الفيديو"));
      }
    } else {
      video.src = source.url;
      video.load();
      startPlayback();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeIndex, sources]);

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-hide controls while playing
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (playing && !showServers) setShowControls(false);
    }, 3000);
  }, [playing, showServers]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [resetControlsTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        video.currentTime += 10;
      } else if (e.key === "ArrowLeft") {
        video.currentTime -= 10;
      } else if (e.key === "f") {
        toggleFullscreen();
      } else if (e.key === "m") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  const changeServer = (index: number) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
    setShowServers(false);
    setCurrent(0);
  };

  const changeRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // RTL: compute from the right edge
    const pos = (rect.right - e.clientX) / rect.width;
    video.currentTime = Math.min(Math.max(pos, 0), 1) * duration;
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (rect.right - e.clientX) / rect.width;
    setProgressHover(Math.min(Math.max(pos, 0), 1));
  };

  const progressPercent = duration ? (current / duration) * 100 : 0;
  const bufferedPercent =
    videoRef.current && duration
      ? (() => {
          const v = videoRef.current;
          if (v.buffered.length === 0) return 0;
          return (v.buffered.end(v.buffered.length - 1) / duration) * 100;
        })()
      : 0;

  const activeSource = sources[activeIndex];

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className="relative w-full bg-black select-none group/player"
      style={{ aspectRatio: "16/9" }}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => playing && !showServers && setShowControls(false)}
    >
      {/* Video element — our own player, so no third-party ads render */}
      <video
        ref={videoRef}
        className="w-full h-full bg-black"
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          setShowControls(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() =>
          setError("تعذر تشغيل هذا السيرفر، جرّب سيرفر آخر من القائمة")
        }
        onEnded={() => setPlaying(false)}
      />

      {/* Loading spinner */}
      {(loading || buffering) && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-14 h-14 border-4 border-white/20 border-t-[#e50914] rounded-full animate-spin" />
        </div>
      )}

      {/* Error / no sources */}
      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6 text-center gap-4">
          <svg
            className="w-14 h-14 text-[#e50914]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-white text-base">{error}</p>
          {sources.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {sources.map((s, i) => (
                <button
                  key={s.url}
                  onClick={() => changeServer(i)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    i === activeIndex
                      ? "bg-[#e50914] text-white"
                      : "bg-[#282828] text-gray-300 hover:bg-[#383838]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial play button */}
      {!playing && !loading && !error && !buffering && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="تشغيل"
        >
          <span className="bg-[#e50914]/90 hover:bg-[#e50914] rounded-full p-5 shadow-2xl transition-transform hover:scale-110">
            <svg
              className="w-12 h-12 text-white mr-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {/* Server picker (top bar) */}
      {sources.length > 0 && (
        <div
          className={`absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
            showControls || showServers ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowServers((v) => !v)}
              className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5"
            >
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
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
                />
              </svg>
              {activeSource?.label || "السيرفر"}
              <svg
                className={`w-3 h-3 transition-transform ${
                  showServers ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {sources[activeIndex]?.type === "hls" && (
              <span className="bg-black/60 text-gray-300 text-[10px] px-2 py-1 rounded-md border border-white/10">
                HLS
              </span>
            )}
          </div>

          {showServers && (
            <div className="mt-2 flex flex-wrap gap-2">
              {sources.map((s, i) => (
                <button
                  key={s.url}
                  onClick={() => changeServer(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                    i === activeIndex
                      ? "bg-[#e50914] text-white border-[#e50914]"
                      : "bg-black/60 text-gray-200 border-white/10 hover:bg-[#282828]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Control bar */}
      {!loading && !error && (
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 pt-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Progress bar */}
          <div
            className="relative h-5 flex items-center cursor-pointer group/bar"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseLeave={() => setProgressHover(null)}
          >
            <div className="relative w-full h-1 group-hover/bar:h-1.5 bg-white/20 rounded-full overflow-hidden transition-all">
              {/* Buffered */}
              <div
                className="absolute top-0 left-0 h-full bg-white/25"
                style={{ width: `${bufferedPercent}%` }}
              />
              {/* Watched */}
              <div
                className="absolute top-0 left-0 h-full bg-[#e50914]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#e50914] rounded-full shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPercent}% - 7px)` }}
            />
            {/* Hover timestamp */}
            {progressHover !== null && duration > 0 && (
              <span
                className="absolute -top-6 bg-black/90 text-white text-[10px] px-1.5 py-0.5 rounded"
                style={{ left: `calc(${progressHover * 100}% - 20px)` }}
              >
                {formatTime(progressHover * duration)}
              </span>
            )}
          </div>

          {/* Buttons row */}
          <div className="flex items-center justify-between gap-2 mt-1">
            {/* Left: play, volume, time */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={togglePlay}
                className="text-white hover:text-[#e50914] transition-colors"
                aria-label={playing ? "إيقاف" : "تشغيل"}
              >
                {playing ? (
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Back 10s */}
              <button
                onClick={() => {
                  const v = videoRef.current;
                  if (v) v.currentTime = Math.max(0, v.currentTime - 10);
                }}
                className="text-white hover:text-[#e50914] transition-colors hidden sm:block"
                aria-label="رجوع 10 ثواني"
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
                    d="M3 10h10a5 5 0 010 10H9M3 10l5-5M3 10l5 5"
                  />
                </svg>
              </button>

              {/* Forward 10s */}
              <button
                onClick={() => {
                  const v = videoRef.current;
                  if (v) v.currentTime = Math.min(duration, v.currentTime + 10);
                }}
                className="text-white hover:text-[#e50914] transition-colors hidden sm:block"
                aria-label="تقديم 10 ثواني"
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
                    d="M21 10H11a5 5 0 000 10h4m6-10l-5-5m5 5l-5 5"
                  />
                </svg>
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2 group/vol">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-[#e50914] transition-colors"
                  aria-label="الصوت"
                >
                  {muted || volume === 0 ? (
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
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                  ) : (
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
                        d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    setMuted(v === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = v === 0;
                    }
                  }}
                  className="w-0 sm:w-16 group-hover/vol:w-16 transition-all accent-[#e50914] cursor-pointer"
                  aria-label="مستوى الصوت"
                />
              </div>

              <span className="text-white text-xs sm:text-sm tabular-nums whitespace-nowrap">
                {formatTime(current)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right: rate, fullscreen */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Playback rate */}
              <div className="relative">
                <button
                  onClick={() => {
                    const rates = [0.5, 1, 1.25, 1.5, 2];
                    const next =
                      rates[(rates.indexOf(playbackRate) + 1) % rates.length];
                    changeRate(next);
                  }}
                  className="text-white hover:text-[#e50914] transition-colors text-xs sm:text-sm font-semibold border border-white/20 rounded px-1.5 py-0.5"
                  aria-label="سرعة التشغيل"
                >
                  {playbackRate}x
                </button>
              </div>

              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-[#e50914] transition-colors"
                aria-label="ملء الشاشة"
              >
                {fullscreen ? (
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
                      d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M15 15v4.5M15 15h4.5M9 15H4.5M9 15v4.5"
                    />
                  </svg>
                ) : (
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
                      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden title for a11y */}
      <span className="sr-only">{title}</span>
    </div>
  );
}
