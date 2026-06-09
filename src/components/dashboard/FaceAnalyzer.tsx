"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FaceResult {
  age?: number;
  gender?: string;
  emotion?: string;
  race?: string;
  emotions?: Record<string, number>;
  region?: { x?: number; y?: number; w?: number; h?: number };
}

interface AnalyzeResponse {
  source?: string;
  deepface?: {
    faces?: FaceResult[];
    count?: number;
    error?: string;
  };
  faces?: FaceResult[];
  count?: number;
  error?: string;
}

function parseFaces(data: AnalyzeResponse): FaceResult[] {
  return data.deepface?.faces ?? data.faces ?? [];
}

function parseError(data: AnalyzeResponse, ok: boolean): string | null {
  if (ok) return null;
  return data.deepface?.error ?? data.error ?? "Face analysis failed";
}

export function FaceAnalyzer() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faces, setFaces] = useState<FaceResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const setPreviewFile = useCallback((file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreview(url);
  }, []);

  const analyzeFile = useCallback(
    async (file: File) => {
      setPreviewFile(file);
      setLoading(true);
      setError(null);
      setFaces([]);

      try {
        const form = new FormData();
        form.append("image", file);

        const res = await fetch("/api/face/analyze", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as AnalyzeResponse;

        if (!res.ok) {
          setError(parseError(data, false) ?? "Face analysis failed");
          return;
        }

        const detected = parseFaces(data);
        if (data.deepface?.error) {
          setError(data.deepface.error);
          return;
        }

        setFaces(detected);
      } catch {
        setError("Network error — face analysis failed");
      } finally {
        setLoading(false);
      }
    },
    [setPreviewFile]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (loading) return;
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) analyzeFile(file);
  };

  return (
    <div className="space-y-6">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!loading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onClick={() => !loading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
          dragActive
            ? "border-violet-400 bg-violet-400/10 scale-[1.01]"
            : "border-border hover:border-violet-400/40 hover:bg-violet-400/5"
        } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {preview ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Face preview"
              className="max-h-72 mx-auto rounded-xl object-contain shadow-lg"
            />
            {!loading && (
              <p className="text-xs text-muted">Click or drop to analyze another photo</p>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-400/10 border border-violet-400/30 flex items-center justify-center text-2xl">
              🧑
            </div>
            <p className="text-sm font-medium">Drop a face photo here</p>
            <p className="text-xs text-muted">DeepFace — age, gender, emotion, race</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) analyzeFile(file);
          }}
        />
      </div>

      {loading && (
        <p className="text-sm text-violet-400 animate-pulse text-center font-medium">
          Running DeepFace analysis… (first run may download models)
        </p>
      )}

      {error && !loading && (
        <p className="text-sm text-error/90 rounded-xl border border-error/30 bg-error/10 px-4 py-3">
          {error}
        </p>
      )}

      {faces.length > 0 && !loading && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400/90">
            {faces.length} face{faces.length !== 1 ? "s" : ""} detected
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {faces.map((face, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface p-4 space-y-3"
              >
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Age</p>
                    <p className="font-semibold">{face.age ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Gender</p>
                    <p className="font-semibold capitalize">{face.gender ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Emotion</p>
                    <p className="font-semibold capitalize">{face.emotion ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Race</p>
                    <p className="font-semibold capitalize">{face.race ?? "—"}</p>
                  </div>
                </div>

                {face.emotions && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted">Emotions</p>
                    {Object.entries(face.emotions)
                      .sort(([, a], [, b]) => b - a)
                      .map(([name, score]) => (
                        <div key={name} className="space-y-1">
                          <div className="flex justify-between text-xs capitalize">
                            <span>{name}</span>
                            <span className="tabular-nums">{Math.round(score)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-400/80"
                              style={{ width: `${Math.min(100, score)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
