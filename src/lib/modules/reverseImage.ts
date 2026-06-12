import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";

export interface ReverseImageInput {
  image?: Blob;
  imageUrl?: string;
}

async function uploadToImgbb(file: Blob): Promise<string> {
  const form = new FormData();
  form.append("image", file);

  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_KEY}`,
    { method: "POST", body: form }
  );
  const data = (await res.json()) as {
    data?: { url?: string };
    error?: { message?: string };
  };

  if (!res.ok || !data.data?.url) {
    throw new Error(data.error?.message ?? "Image upload failed");
  }

  return data.data.url;
}

/** Anonymous fallback when IMGBB_KEY is not configured (public URL for reverse search). */
async function uploadToCatbox(file: Blob): Promise<string> {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", file, "image.jpg");

  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  const url = (await res.text()).trim();
  if (!res.ok || !url.startsWith("https://")) {
    throw new Error(`catbox failed (${res.status}): ${url.slice(0, 80)}`);
  }

  return url;
}

async function uploadToTmpfiles(file: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", file, "image.jpg");

  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json()) as { status?: string; data?: { url?: string } };
  const pageUrl = data.data?.url;
  if (!res.ok || data.status !== "success" || !pageUrl) {
    throw new Error("tmpfiles upload failed");
  }

  const match = pageUrl.match(/tmpfiles\.org\/([^/]+)\/(.+)$/i);
  if (!match) {
    throw new Error("tmpfiles URL parse failed");
  }

  return `https://tmpfiles.org/dl/${match[1]}/${match[2]}`;
}

async function uploadForPublicUrl(file: Blob): Promise<{ url: string; via: "imgbb" | "catbox" | "tmpfiles" }> {
  if (hasEnv("IMGBB_KEY")) {
    try {
      const url = await uploadToImgbb(file);
      return { url, via: "imgbb" };
    } catch {
      // fall through to anonymous hosts
    }
  }

  try {
    const url = await uploadToCatbox(file);
    return { url, via: "catbox" };
  } catch {
    // fall through to tmpfiles
  }

  try {
    const url = await uploadToTmpfiles(file);
    return { url, via: "tmpfiles" };
  } catch {
    throw new Error(
      "Image hosting failed — add IMGBB_KEY (imgbb.com) or try again shortly"
    );
  }
}

async function resolveTarget(input: ReverseImageInput): Promise<{
  target: string;
  imageBlob?: Blob;
  uploadVia?: "imgbb" | "catbox" | "tmpfiles";
}> {
  const url = input.imageUrl?.trim();
  if (url) {
    return { target: url };
  }

  if (input.image && input.image.size > 0) {
    const { url: target, via } = await uploadForPublicUrl(input.image);
    return { target, imageBlob: input.image, uploadVia: via };
  }

  throw new Error("Provide an image file or image URL");
}

async function blobForBing(imageBlob: Blob | undefined, target: string): Promise<Blob> {
  if (imageBlob) return imageBlob;
  const res = await fetch(target, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error("Failed to fetch image URL for Bing Visual Search");
  return res.blob();
}

async function searchSerpApi(target: string) {
  if (!hasEnv("SERPAPI_KEY")) {
    return skippedSource("Add SERPAPI_KEY (serpapi.com — 100 free searches/mo)");
  }

  const res = await fetchJson(
    `https://serpapi.com/search.json?engine=google_reverse_image&image_url=${encodeURIComponent(target)}&api_key=${process.env.SERPAPI_KEY}`,
    undefined,
    20_000
  );

  return res.data;
}

async function searchBing(imageBlob: Blob | undefined, target: string) {
  if (!hasEnv("BING_VISION_KEY")) {
    return skippedSource("Add BING_VISION_KEY (portal.azure.com — free tier 1000/mo)");
  }

  const blob = await blobForBing(imageBlob, target);
  const form = new FormData();
  form.append("image", blob, "image.jpg");

  const res = await fetchJson(
    "https://api.bing.microsoft.com/v7.0/images/visualsearch",
    {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": process.env.BING_VISION_KEY! },
      body: form,
    },
    20_000
  );

  return res.data;
}

async function searchTineye(target: string) {
  if (!hasEnv("TINEYE_KEY")) {
    return skippedSource("Add TINEYE_KEY (tineye.com/api — free tier 150/mo)");
  }

  const form = new FormData();
  form.append("url", target);
  form.append("offset", "0");
  form.append("limit", "10");
  form.append("sort", "score");
  form.append("order", "desc");

  const res = await fetchJson(
    "https://api.tineye.com/rest/search/",
    {
      method: "POST",
      headers: { "X-API-Key": process.env.TINEYE_KEY! },
      body: form,
    },
    20_000
  );

  return res.data;
}

export function buildManualLinks(target: string) {
  return {
    yandex: `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(target)}`,
    pimeyes: "https://pimeyes.com",
    facecheck: "https://facecheck.id",
    google: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(target)}`,
  };
}

export async function runReverseImageSearch(input: ReverseImageInput) {
  const url = input.imageUrl?.trim();
  const hasFile = Boolean(input.image && input.image.size > 0);

  if (!url && !hasFile) {
    return {
      source: "Reverse Image Search",
      error: "Provide an image file or public image URL",
      manualLinks: {},
    };
  }

  let target: string;
  let imageBlob: Blob | undefined;
  let uploadVia: "imgbb" | "catbox" | "tmpfiles" | undefined;

  try {
    ({ target, imageBlob, uploadVia } = await resolveTarget(input));
  } catch (err) {
    return {
      source: "Reverse Image Search",
      error: err instanceof Error ? err.message : String(err),
      manualLinks: {},
    };
  }

  const [serpapi, bing, tineye] = await Promise.allSettled([
    searchSerpApi(target),
    searchBing(imageBlob, target),
    searchTineye(target),
  ]);

  return {
    source: "Reverse Image Search",
    imageUrl: target,
    upload:
      uploadVia === "tmpfiles"
        ? {
            via: "tmpfiles",
            note: "Hosted via tmpfiles.org fallback — add IMGBB_KEY for production use",
          }
        : uploadVia === "catbox"
        ? {
            via: "catbox",
            note: "Hosted via catbox fallback — add IMGBB_KEY for production use",
          }
        : uploadVia === "imgbb"
          ? { via: "imgbb" }
          : undefined,
    google: serpapi.status === "fulfilled" ? serpapi.value : null,
    bing: bing.status === "fulfilled" ? bing.value : null,
    tineye: tineye.status === "fulfilled" ? tineye.value : null,
    manualLinks: buildManualLinks(target),
  };
}
