import { useState, useEffect, useRef, useMemo } from 'react';
import { Image, Spin } from 'antd';

/**
 * OptimizedImage — lazy-loaded image with skeleton + graceful fallback.
 *
 * No URL derivation happens here. Callers pass the exact paths returned by the
 * API: `optimizedSrc` (WebP, max 1200px) and/or `thumbSrc` (200px WebP) and/or
 * `src` (original). The component tries, in order:
 *   - thumbSrc (when useThumb) / optimizedSrc (otherwise)
 *   - src (original) as the final fallback
 * Legacy records that only carry `src` work unchanged.
 *
 * Props:
 *   src          string | null   original URL (kept for fallback)
 *   optimizedSrc string | null   optimized WebP URL
 *   thumbSrc     string | null   thumbnail WebP URL
 *   alt          string
 *   className    string          applied to the <img> element
 *   useThumb     boolean         prefer thumbnail for small displays (default false)
 *   eager        boolean         skip lazy-loading (default false)
 *   preview      boolean         enable Ant lightbox preview (default true)
 */
export default function OptimizedImage({
  src,
  optimizedSrc,
  thumbSrc,
  alt = '',
  className = '',
  useThumb = false,
  eager = false,
  preview = true,
}) {
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const ref = useRef(null);

  const candidates = useMemo(() => {
    const list = [];
    if (useThumb) {
      if (thumbSrc) list.push(thumbSrc);
    } else if (optimizedSrc) {
      list.push(optimizedSrc);
    }
    if (src) list.push(src);
    return list;
  }, [useThumb, thumbSrc, optimizedSrc, src]);

  const currentSrc = candidates[candidateIdx];

  // Reset state whenever the candidate list / current selection changes
  useEffect(() => {
    setCandidateIdx(0);
    setLoaded(false);
    setErrored(false);
  }, [candidates.join('|')]);

  useEffect(() => {
    if (eager) {
      setInView(true);
      return;
    }
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [eager]);

  useEffect(() => {
    let active = true;
    if (inView && !loaded && !errored && currentSrc) {
      // Preload the next candidate so onLoad/onError below resolve cleanly.
      const img = new window.Image();
      img.onload = () => { if (active) setLoaded(true); };
      img.onerror = () => { if (active) setErrored(true); };
      img.src = currentSrc;
      return () => { active = false; };
    }
  }, [inView, loaded, errored, currentSrc]);

  if (!currentSrc) {
    return null;
  }

  const showOverlay = inView && !loaded && !errored;

  return (
    <div ref={ref} className="relative inline-block">
      {inView && (
        <Image
          src={currentSrc}
          alt={alt}
          className={`${className} ${showOverlay ? 'opacity-60' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (candidateIdx < candidates.length - 1) {
              setCandidateIdx(candidateIdx + 1);
              setLoaded(false);
            } else {
              setErrored(true);
            }
          }}
          preview={preview ? { mask: 'View' } : false}
        />
      )}
      {showOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/60 rounded-lg">
          <Spin size="small" />
        </div>
      )}
      {inView && errored && (
        <div className="flex flex-col items-center justify-center h-24 bg-slate-50 rounded-lg text-slate-400 border border-slate-200">
          <span className="text-xs">Image unavailable</span>
        </div>
      )}
    </div>
  );
}