"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPreviewUrl, isImageFile, prepareImageUpload, resetFileInput } from "@/lib/imageUpload";
import { UploadKeysBanner } from "@/components/dashboard/UploadKeysBanner";

interface ReverseImageResult {
  source?: string;
  imageUrl?: string;
  google?: Record<string, unknown> | null;
  bing?: Record<string, unknown> | null;
  tineye?: Record<string, unknown> | null;
  manualLinks?: Record<string, string>;
  error?: string;
  upload?: { skipped?: boolean; reason?: string };
}

function SkippedBanner({ data }: { data: unknown }) {
  const item = data as { skipped?: boolean; reason?: string } | null;
  if (!item?.skipped) return null;
  return <p className="text-xs text-muted italic">{item.reason ?? "Skipped"}</p>;
}

function ResultLinks({ data }: { data: Record<string, unknown> | null | undefined }) {
  if (!data || (data as { skipped?: boolean }).skipped) return null;

  const items = (data as { image_results?: Array<{ title?: string; link?: string; source?: string }> })
    .image_results;
  const matches = (data as { matches?: Array<{ backlink?: string; domain?: string }> }).matches;
  const results = (data as { results?: { matches?: Array<{ backlink?: string }> } }).results?.matches;

  const links: Array<{ title: string; href: string }> = [];

  if (Array.isArray(items)) {
    for (const item of items.slice(0, 8)) {
      if (item.link) links.push({ title: item.title ?? item.source ?? item.link, href: item.link });
    }
  }

  const tineyeMatches = matches ?? results;
  if (Array.isArray(tineyeMatches)) {
    for (const item of tineyeMatches.slice(0, 8)) {
      if (item.backlink) links.push({ title: item.backlink, href: item.backlink });
    }
  }

  const tags = (data as { tags?: Array<{ displayName?: string; actions?: Array<{ actionType?: string; data?: { value?: string } }> }> })
    .tags;
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      for (const action of tag.actions ?? []) {
        if (action.actionType === "PagesIncluding" && action.data?.value) {
          links.push({ title: tag.displayName ?? "Visual match", href: action.data.value });
        }
      }
    }
  }

  if (!links.length) {
    return <p className="text-sm text-muted">No structured matches — check raw response or manual links.</p>;
  }

  return (
    <ul className="space-y-2 max-h-48 overflow-auto text-xs">
      {links.map((link, i) => (
        <li key={i} className="border-b border-border/50 pb-2">
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline break-all"
          >
            {link.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ReverseImageSearch() {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReverseImageResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const setPreviewFile = useCallback((file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = createPreviewUrl(file);
    previewUrlRef.current = url;
    setPreview(url);
    setSelectedFile(file);
  }, []);

  const selectFile = useCallback(
    async (file: File) => {
      try {
        const prepared = await prepareImageUpload(file);
        setPreviewFile(prepared);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not prepare image for upload");
        resetFileInput(inputRef.current);
      }
    },
    [setPreviewFile]
  );

  const runSearch = useCallback(async () => {
    if (!selectedFile && !imageUrl.trim()) {
      setError("Upload an image or enter a public image URL");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      if (selectedFile) form.append("image", selectedFile);
      if (imageUrl.trim()) form.append("url", imageUrl.trim());

      const res = await fetch("/api/reverse-image", { method: "POST", body: form });
      const data = (await res.json()) as ReverseImageResult;

      if (data.error && !data.imageUrl) {
        setError(data.error.replace(/^Error: /, ""));
        setResult(data.upload ? data : null);
        return;
      }

      setResult(data);
    } catch {
      setError("Network error — reverse image search failed");
    } finally {
      setLoading(false);
    }
  }, [imageUrl, selectedFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (loading) return;
    const file = e.dataTransfer.files[0];
    if (file && isImageFile(file)) void selectFile(file);
  };

  return (
    <div className="space-y-6">
      <UploadKeysBanner keys={["IMGBB_KEY", "BING_VISION_KEY", "SERPAPI_KEY", "TINEYE_KEY"]} />
      <div className="space-y-2">
        <label htmlFor="image-url" className="text-xs text-muted">
          Public image URL (optional — skips imgbb upload)
        </label>
        <input
          id="image-url"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          disabled={loading}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
        />
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!loading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onClick={() => !loading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragActive
            ? "border-cyan-400 bg-cyan-400/10 scale-[1.01]"
            : "border-border hover:border-cyan-400/40 hover:bg-cyan-400/5"
        } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Search preview" className="max-h-56 mx-auto rounded-xl object-contain" />
        ) : (
          <div className="space-y-2 py-4">
            <p className="text-sm font-medium">Drop an image or click to upload</p>
            <p className="text-xs text-muted">
              File uploads work without IMGBB_KEY (temporary host). Add API keys for automated results.
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void selectFile(file);
            resetFileInput(e.target);
          }}
        />
      </div>

      <button
        type="button"
        onClick={runSearch}
        disabled={loading || (!selectedFile && !imageUrl.trim())}
        className="w-full rounded-xl bg-cyan-500/90 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 transition-colors"
      >
        {loading ? "Searching…" : "Reverse image search"}
      </button>

      {loading && (
        <p className="text-sm text-cyan-400 animate-pulse text-center">
          Querying SerpApi, Bing Visual Search, and TinEye…
        </p>
      )}

      {error && !loading && (
        <p className="text-sm text-error/90 rounded-xl border border-error/30 bg-error/10 px-4 py-3">
          {error}
        </p>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {result.imageUrl && (
            <p className="text-xs text-muted break-all">
              Target:{" "}
              <a
                href={result.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                {result.imageUrl}
              </a>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Google (SerpApi)</p>
              <SkippedBanner data={result.google} />
              <ResultLinks data={result.google} />
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Bing Visual</p>
              <SkippedBanner data={result.bing} />
              <ResultLinks data={result.bing} />
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">TinEye</p>
              <SkippedBanner data={result.tineye} />
              <ResultLinks data={result.tineye} />
            </div>
          </div>

          {result.manualLinks && (
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">
                Manual search links
              </p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                {Object.entries(result.manualLinks).map(([name, href]) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border bg-surface px-3 py-2 hover:border-cyan-400/40 capitalize"
                  >
                    {name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
