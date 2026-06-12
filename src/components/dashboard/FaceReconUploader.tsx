"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isImageFile, resetFileInput } from "@/lib/imageUpload";
import { UploadKeysBanner } from "@/components/dashboard/UploadKeysBanner";

interface FaceRegion {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

interface FaceResult {
  age?: number;
  gender?: string;
  emotion?: string;
  race?: string;
  emotions?: Record<string, number>;
  gender_scores?: Record<string, number>;
  race_scores?: Record<string, number>;
  region?: FaceRegion;
}

interface FaceAnalyzeResponse {
  deepface?: {
    faces?: FaceResult[];
    error?: string;
  };
  error?: string;
}

interface ReverseLinkRow {
  title: string;
  href: string;
  subtitle?: string;
}

interface ReverseImageResult {
  imageUrl?: string;
  google?: {
    skipped?: boolean;
    reason?: string;
    image_results?: Array<{ title?: string; link?: string; source?: string }>;
  } | null;
  bing?: {
    skipped?: boolean;
    reason?: string;
    tags?: Array<{
      displayName?: string;
      actions?: Array<{ actionType?: string; data?: { value?: string } }>;
    }>;
  } | null;
  tineye?: {
    skipped?: boolean;
    reason?: string;
    results?: {
      matches?: Array<{ backlink?: string; domain?: string; score?: number }>;
      total_results?: number;
    };
  } | null;
  manualLinks?: Record<string, string>;
  error?: string;
  upload?: { skipped?: boolean; reason?: string };
}

type StepStatus = "pending" | "running" | "done" | "skipped" | "error";

interface PipelineStep {
  id: string;
  label: string;
  detail: string;
  status: StepStatus;
  note?: string;
}

const MANUAL_LINK_KEYS = ["yandex", "pimeyes", "facecheck", "google"] as const;

const MANUAL_LINK_LABELS: Record<(typeof MANUAL_LINK_KEYS)[number], string> = {
  yandex: "Yandex",
  pimeyes: "PimEyes",
  facecheck: "FaceCheck.id",
  google: "Google Lens",
};

function openManualLinks(links: Record<string, string>) {
  for (const key of MANUAL_LINK_KEYS) {
    const href = links[key];
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }
}

function formatBbox(region?: FaceRegion): string {
  if (!region || region.x == null || region.y == null || region.w == null || region.h == null) {
    return "—";
  }
  return `x${region.x} y${region.y} · ${region.w}×${region.h}px`;
}

function ConfidenceBars({
  label,
  scores,
  highlight,
}: {
  label: string;
  scores?: Record<string, number>;
  highlight?: string;
}) {
  if (!scores || !Object.keys(scores).length) return null;

  const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      {entries.map(([name, score]) => {
        const active = highlight?.toLowerCase() === name.toLowerCase();
        return (
          <div key={name} className="space-y-1">
            <div className="flex justify-between text-xs capitalize">
              <span className={active ? "text-violet-400 font-medium" : ""}>{name}</span>
              <span className="tabular-nums">{Math.round(score)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full ${active ? "bg-violet-400" : "bg-violet-400/50"}`}
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultRows({
  title,
  rows,
  skippedReason,
  emptyMessage = "No matches returned.",
}: {
  title: string;
  rows: ReverseLinkRow[];
  skippedReason?: string;
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      {skippedReason && <p className="text-xs text-muted italic">{skippedReason}</p>}
      {!skippedReason && rows.length === 0 && (
        <p className="text-sm text-muted">{emptyMessage}</p>
      )}
      {rows.length > 0 && (
        <ul className="space-y-2 max-h-52 overflow-auto">
          {rows.map((row, i) => (
            <li key={i} className="border-b border-border/50 pb-2 last:border-0">
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cyan-400 hover:underline break-all"
              >
                {row.title}
              </a>
              {row.subtitle && <p className="text-xs text-muted mt-0.5">{row.subtitle}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PipelinePanel({ steps }: { steps: PipelineStep[] }) {
  const statusStyles: Record<StepStatus, string> = {
    pending: "text-muted border-border/60",
    running: "text-violet-400 border-violet-400/40 animate-pulse",
    done: "text-emerald-400 border-emerald-400/40",
    skipped: "text-amber-400 border-amber-400/40",
    error: "text-error border-error/40",
  };

  const statusIcon: Record<StepStatus, string> = {
    pending: "○",
    running: "◉",
    done: "✓",
    skipped: "—",
    error: "✕",
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Recon pipeline</p>
      {steps.map((step, i) => (
        <div key={step.id} className="flex gap-3 items-start py-2">
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${statusStyles[step.status]}`}>
            {statusIcon[step.status]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{step.label}</p>
              {i < steps.length - 1 && (
                <span className="hidden sm:inline text-muted text-xs">↓</span>
              )}
            </div>
            <p className="text-xs text-muted">{step.detail}</p>
            {step.note && <p className="text-xs text-muted/80 mt-0.5 italic">{step.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function FacePreview({
  src,
  faces,
}: {
  src: string;
  faces: FaceResult[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = containerRef.current?.getBoundingClientRect();
    setSize({
      width: rect?.width ?? img.clientWidth,
      height: rect?.height ?? img.clientHeight,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
  };

  const scaleX = size.naturalWidth ? size.width / size.naturalWidth : 1;
  const scaleY = size.naturalHeight ? size.height / size.naturalHeight : 1;

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        onLoad={onLoad}
        className="max-h-72 rounded-xl object-contain shadow-lg block max-w-full"
        alt="Uploaded face"
      />
      {faces.map((face, i) => {
        const r = face.region;
        if (!r || r.x == null || r.y == null || r.w == null || r.h == null) return null;
        return (
          <div
            key={i}
            className="absolute border-2 border-violet-400 rounded-sm pointer-events-none"
            style={{
              left: r.x * scaleX,
              top: r.y * scaleY,
              width: r.w * scaleX,
              height: r.h * scaleY,
            }}
          >
            <span className="absolute -top-5 left-0 text-[10px] font-semibold text-violet-400 bg-surface/90 px-1 rounded">
              Face {i + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function parseGoogleRows(data: ReverseImageResult["google"]): ReverseLinkRow[] {
  if (!data || data.skipped || !Array.isArray(data.image_results)) return [];
  return data.image_results.slice(0, 8).flatMap((item) =>
    item.link
      ? [{ title: item.title ?? item.source ?? item.link, href: item.link, subtitle: item.source }]
      : []
  );
}

function parseBingRows(data: ReverseImageResult["bing"]): ReverseLinkRow[] {
  if (!data || data.skipped || !Array.isArray(data.tags)) return [];
  const rows: ReverseLinkRow[] = [];
  for (const tag of data.tags) {
    for (const action of tag.actions ?? []) {
      if (action.actionType === "PagesIncluding" && action.data?.value) {
        rows.push({
          title: tag.displayName ?? "Visual match",
          href: action.data.value,
        });
      }
    }
  }
  return rows.slice(0, 8);
}

function parseTineyeRows(data: ReverseImageResult["tineye"]): ReverseLinkRow[] {
  if (!data || data.skipped) return [];
  const matches = data.results?.matches ?? [];
  return matches.slice(0, 8).flatMap((item) =>
    item.backlink
      ? [
          {
            title: item.backlink,
            href: item.backlink,
            subtitle: item.domain
              ? `${item.domain}${item.score != null ? ` · score ${item.score}` : ""}`
              : undefined,
          },
        ]
      : []
  );
}

function buildPipelineSteps(
  loading: boolean,
  faceResult: FaceAnalyzeResponse | null,
  reverseResult: ReverseImageResult | null,
  manualOpened: boolean
): PipelineStep[] {
  const faces = faceResult?.deepface?.faces ?? [];
  const faceError = faceResult?.deepface?.error ?? faceResult?.error;
  const reverseError = reverseResult?.error;

  const deepfaceStatus: StepStatus = loading
    ? "running"
    : faceError
      ? "error"
      : faces.length > 0
        ? "done"
        : faceResult
          ? "skipped"
          : "pending";

  const imgbbStatus: StepStatus = loading
    ? "running"
    : reverseResult?.imageUrl
      ? "done"
      : reverseError
        ? "error"
        : reverseResult
          ? "skipped"
          : "pending";

  const providerStatus = (
    data: { skipped?: boolean; reason?: string } | null | undefined,
    hasRows: boolean
  ): StepStatus => {
    if (loading) return "running";
    if (!reverseResult) return "pending";
    if (reverseError && !reverseResult.imageUrl) return "error";
    if (data?.skipped) return "skipped";
    if (hasRows) return "done";
    if (reverseResult.imageUrl) return "done";
    return "skipped";
  };

  const googleRows = parseGoogleRows(reverseResult?.google);
  const bingRows = parseBingRows(reverseResult?.bing);
  const tineyeRows = parseTineyeRows(reverseResult?.tineye);

  const manualStatus: StepStatus = loading
    ? "pending"
    : manualOpened
      ? "done"
      : reverseResult?.manualLinks
        ? "skipped"
        : "pending";

  return [
    {
      id: "deepface",
      label: "DeepFace (local)",
      detail: "age, gender, emotion, ethnicity, bbox",
      status: deepfaceStatus,
      note: faceError ?? (faces.length ? `${faces.length} face(s)` : undefined),
    },
    {
      id: "imgbb",
      label: "imgbb upload",
      detail: "public URL for reverse search engines",
      status: imgbbStatus,
      note: reverseResult?.imageUrl ? "URL ready" : reverseError,
    },
    {
      id: "google",
      label: "SerpApi Google",
      detail: "where this image appears online",
      status: providerStatus(reverseResult?.google, googleRows.length > 0),
      note: reverseResult?.google?.skipped ? reverseResult.google.reason : undefined,
    },
    {
      id: "bing",
      label: "Bing Visual Search",
      detail: "Microsoft visual matches",
      status: providerStatus(reverseResult?.bing, bingRows.length > 0),
      note: reverseResult?.bing?.skipped ? reverseResult.bing.reason : undefined,
    },
    {
      id: "tineye",
      label: "TinEye",
      detail: "exact / near duplicate finder",
      status: providerStatus(reverseResult?.tineye, tineyeRows.length > 0),
      note: reverseResult?.tineye?.skipped ? reverseResult.tineye.reason : undefined,
    },
    {
      id: "manual",
      label: "Manual links",
      detail: "Yandex, PimEyes, FaceCheck.id, Google Lens",
      status: manualStatus,
      note: manualOpened ? "Opened in new tabs" : undefined,
    },
  ];
}

export function FaceReconUploader() {
  const [preview, setPreview] = useState<string | null>(null);
  const [faceResult, setFaceResult] = useState<FaceAnalyzeResponse | null>(null);
  const [reverseResult, setReverseResult] = useState<ReverseImageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpened, setManualOpened] = useState(false);
  const [autoOpenManual, setAutoOpenManual] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const lastOpenedUrlRef = useRef<string | null>(null);

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

  const handleFile = useCallback(
    async (file: File) => {
      if (!isImageFile(file)) {
        setError("Please upload an image file (JPEG, PNG, WebP, HEIC, etc.)");
        resetFileInput(inputRef.current);
        return;
      }

      setPreviewFile(file);
      setLoading(true);
      setError(null);
      setFaceResult(null);
      setReverseResult(null);
      setManualOpened(false);
      lastOpenedUrlRef.current = null;

      const faceForm = new FormData();
      faceForm.append("image", file);

      const revForm = new FormData();
      revForm.append("image", file);

      try {
        const [faceRes, revRes] = await Promise.allSettled([
          fetch("/api/face", { method: "POST", body: faceForm }).then(async (r) => r.json()),
          fetch("/api/reverse-image", { method: "POST", body: revForm }).then(async (r) => r.json()),
        ]);

        if (faceRes.status === "fulfilled") {
          setFaceResult(faceRes.value as FaceAnalyzeResponse);
        } else {
          setError("Face analysis request failed");
        }

        if (revRes.status === "fulfilled") {
          const revData = revRes.value as ReverseImageResult;
          setReverseResult(revData);

          if (autoOpenManual && revData.manualLinks && revData.imageUrl) {
            if (lastOpenedUrlRef.current !== revData.imageUrl) {
              openManualLinks(revData.manualLinks);
              lastOpenedUrlRef.current = revData.imageUrl;
              setManualOpened(true);
            }
          }
        }
      } catch {
        setError("Network error — analysis failed");
      } finally {
        setLoading(false);
        resetFileInput(inputRef.current);
      }
    },
    [autoOpenManual, setPreviewFile]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (loading) return;
    const file = e.dataTransfer.files[0];
    if (file && isImageFile(file)) handleFile(file);
  };

  const faces = faceResult?.deepface?.faces ?? [];
  const faceError = faceResult?.deepface?.error ?? faceResult?.error;
  const googleRows = parseGoogleRows(reverseResult?.google);
  const bingRows = parseBingRows(reverseResult?.bing);
  const tineyeRows = parseTineyeRows(reverseResult?.tineye);
  const manualLinks = reverseResult?.manualLinks ?? {};
  const pipelineSteps = buildPipelineSteps(loading, faceResult, reverseResult, manualOpened);

  return (
    <div className="space-y-6">
      <UploadKeysBanner keys={["IMGBB_KEY", "BING_VISION_KEY", "SERPAPI_KEY", "TINEYE_KEY"]} />
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!loading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
          dragActive
            ? "border-violet-400 bg-violet-400/10 scale-[1.01]"
            : "border-border hover:border-violet-400/40 hover:bg-violet-400/5"
        } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {preview ? (
          <div className="flex justify-center">
            <FacePreview src={preview} faces={faces} />
          </div>
        ) : (
          <div className="space-y-3 py-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-400/10 border border-violet-400/30 flex items-center justify-center text-2xl">
              🧑
            </div>
            <p className="text-sm font-medium">Photo upload</p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              DeepFace + imgbb + SerpApi + Bing + TinEye + manual OSINT links
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
            if (file) handleFile(file);
          }}
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={autoOpenManual}
          onChange={(e) => setAutoOpenManual(e.target.checked)}
          className="rounded border-border"
        />
        Auto-open manual search tabs (Yandex, PimEyes, FaceCheck.id, Google Lens)
      </label>

      {(loading || faceResult || reverseResult) && <PipelinePanel steps={pipelineSteps} />}

      {loading && (
        <p className="text-sm text-violet-400 animate-pulse text-center font-medium">
          Running parallel recon pipeline…
        </p>
      )}

      {error && !loading && (
        <p className="text-sm text-error/90 rounded-xl border border-error/30 bg-error/10 px-4 py-3">
          {error}
        </p>
      )}

      {faceError && !loading && (
        <p className="text-sm text-amber-400/90 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
          {faceError}
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
                <p className="text-sm font-medium">Face {i + 1}</p>
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
                    <p className="text-[10px] uppercase tracking-wider text-muted">Ethnicity</p>
                    <p className="font-semibold capitalize">{face.race ?? "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted">BBox</p>
                    <p className="font-mono text-xs">{formatBbox(face.region)}</p>
                  </div>
                </div>
                <ConfidenceBars label="Emotion confidence" scores={face.emotions} highlight={face.emotion} />
                <ConfidenceBars label="Gender confidence" scores={face.gender_scores} highlight={face.gender} />
                <ConfidenceBars label="Ethnicity confidence" scores={face.race_scores} highlight={face.race} />
              </div>
            ))}
          </div>
        </div>
      )}

      {reverseResult?.error && !loading && (
        <p className="text-sm text-amber-400/90 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
          Reverse search: {reverseResult.error}
        </p>
      )}

      {reverseResult && !loading && (
        <div className="space-y-4">
          {reverseResult.imageUrl && (
            <p className="text-xs text-muted break-all">
              imgbb URL:{" "}
              <a
                href={reverseResult.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                {reverseResult.imageUrl}
              </a>
            </p>
          )}

          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">
                Manual search
              </p>
              {Object.keys(manualLinks).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    openManualLinks(manualLinks);
                    setManualOpened(true);
                  }}
                  className="text-xs rounded-lg border border-border bg-surface px-2.5 py-1 hover:border-cyan-400/40"
                >
                  Open all ↗
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {MANUAL_LINK_KEYS.map((key) => {
                const href = manualLinks[key];
                if (!href) return null;
                return (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:border-cyan-400/40 transition"
                  >
                    {MANUAL_LINK_LABELS[key]} ↗
                  </a>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ResultRows
              title="Google (SerpApi)"
              rows={googleRows}
              skippedReason={reverseResult.google?.skipped ? reverseResult.google.reason : undefined}
            />
            <ResultRows
              title="Bing Visual"
              rows={bingRows}
              skippedReason={reverseResult.bing?.skipped ? reverseResult.bing.reason : undefined}
            />
            <ResultRows
              title="TinEye"
              rows={tineyeRows}
              skippedReason={reverseResult.tineye?.skipped ? reverseResult.tineye.reason : undefined}
              emptyMessage={
                reverseResult.tineye?.results?.total_results
                  ? `${reverseResult.tineye.results.total_results} match(es) — no link details in response`
                  : "No matches returned."
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
