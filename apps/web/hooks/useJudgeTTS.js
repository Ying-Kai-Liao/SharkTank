"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TTS_ENDPOINT = "/api/tts";
const CACHE_MAX_SIZE = 50;
const MAX_TEXT_LENGTH = 5000;

function getPlaybackKey(phase, groupIndex, lineIndex, offerLineIndex) {
  if (phase === "judging") return `judging-${groupIndex}-${lineIndex}`;
  if (phase === "offer-dialogue") return `offer-${offerLineIndex}`;
  return null;
}

const cache = new Map();

function evictCacheIfNeeded() {
  if (cache.size <= CACHE_MAX_SIZE) return;
  const firstKey = cache.keys().next().value;
  if (firstKey === undefined) return;
  const entry = cache.get(firstKey);
  cache.delete(firstKey);
  if (entry?.blobUrl) {
    try {
      URL.revokeObjectURL(entry.blobUrl);
    } catch (_) {}
  }
}

function getCachedBlobUrl(key) {
  const entry = cache.get(key);
  return entry?.blobUrl ?? null;
}

function setCachedBlobUrl(key, blobUrl) {
  evictCacheIfNeeded();
  cache.set(key, { blobUrl });
}

/**
 * Hook for judge TTS: plays audio for the current dialogue line when in judging or offer-dialogue phase.
 * Caches by playback key to avoid duplicate API calls. Supports retry, stop, and optional onPlaybackEnd.
 *
 * @param {object} opts
 * @param {string} opts.phase - Current phase (e.g. "judging", "offer-dialogue")
 * @param {number} opts.groupIndex - Current dialogue group index (judging)
 * @param {number} opts.lineIndex - Current line index (judging)
 * @param {number} opts.offerLineIndex - Current offer line index (offer-dialogue)
 * @param {string} opts.dialogueText - Text to speak
 * @param {string|null} opts.judgeId - Judge id (cat, dog, shark) for voice selection
 * @param {() => void} [opts.onPlaybackEnd] - Called when the current clip finishes
 */
export function useJudgeTTS({
  phase,
  groupIndex,
  lineIndex,
  offerLineIndex,
  dialogueText,
  judgeId,
  onPlaybackEnd
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playbackKey = getPlaybackKey(phase, groupIndex, lineIndex, offerLineIndex);
  const shouldPlay =
    (phase === "judging" || phase === "offer-dialogue") &&
    playbackKey &&
    typeof dialogueText === "string" &&
    dialogueText.trim().length > 0 &&
    judgeId &&
    ["cat", "dog", "shark"].includes(judgeId);

  const abortRef = useRef(null);
  const audioRef = useRef(null);
  const lastPlaybackKeyRef = useRef(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener("ended", audio._onEnded);
      audio._onEnded = null;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    lastPlaybackKeyRef.current = null;
  }, []);

  useEffect(() => {
    if (!shouldPlay) {
      stop();
      return;
    }

    if (lastPlaybackKeyRef.current === playbackKey) return;
    lastPlaybackKeyRef.current = playbackKey;

    stop();

    const raw = dialogueText.trim();
    if (!raw) return;
    const text = raw.length > MAX_TEXT_LENGTH ? raw.slice(0, MAX_TEXT_LENGTH) : raw;

    const cached = getCachedBlobUrl(playbackKey);
    if (cached) {
      const audio = new Audio(cached);
      audioRef.current = audio;
      const onEnded = () => {
        setIsPlaying(false);
        audioRef.current = null;
        audio.removeEventListener("ended", onEnded);
        audio._onEnded = null;
        onPlaybackEnd?.();
      };
      audio._onEnded = onEnded;
      audio.addEventListener("ended", onEnded);
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);

    fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, judgeId }),
      signal: controller.signal
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => Promise.reject(new Error(data?.error || "TTS failed")));
        }
        return res.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        const blobUrl = URL.createObjectURL(blob);
        setCachedBlobUrl(playbackKey, blobUrl);
        const audio = new Audio(blobUrl);
        audioRef.current = audio;
        const onEnded = () => {
          setIsPlaying(false);
          audioRef.current = null;
          audio.removeEventListener("ended", onEnded);
          audio._onEnded = null;
          onPlaybackEnd?.();
        };
        audio._onEnded = onEnded;
        audio.addEventListener("ended", onEnded);
        setIsLoading(false);
        return audio.play().then(() => setIsPlaying(true));
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setIsLoading(false);
        setError(err?.message || "Could not play audio");
      });

    return () => {
      controller.abort();
    };
  }, [shouldPlay, playbackKey, dialogueText, judgeId, stop, onPlaybackEnd]);

  useEffect(() => {
    return () => {
      stop();
      cache.forEach((entry) => {
        if (entry?.blobUrl) {
          try {
            URL.revokeObjectURL(entry.blobUrl);
          } catch (_) {}
        }
      });
      cache.clear();
    };
  }, [stop]);

  return { isLoading, error, isPlaying, retry, stop };
}
