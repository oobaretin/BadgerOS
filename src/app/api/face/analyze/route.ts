import { NextRequest, NextResponse } from "next/server";

const FACE_SERVER_URL = process.env.FACE_SERVER_URL ?? "http://127.0.0.1:5001";

export const maxDuration = 60;

async function imageToBase64(image: File | Blob): Promise<string> {
  const bytes = await image.arrayBuffer();
  return Buffer.from(bytes).toString("base64");
}

async function callDeepFace(base64: string) {
  const res = await fetch(`${FACE_SERVER_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64 }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      error: (data as { error?: string }).error ?? "Face analysis failed",
      status: res.status,
    };
  }

  return { data, status: 200 };
}

export async function POST(req: NextRequest) {
  let base64: string | null = null;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const image = formData.get("image");
    if (!(image instanceof Blob) || image.size === 0) {
      return NextResponse.json({ error: "No image" }, { status: 400 });
    }
    base64 = await imageToBase64(image);
  } else {
    const body = await req.json().catch(() => null);
    const raw = body?.image;
    if (typeof raw !== "string" || !raw.trim()) {
      return NextResponse.json({ error: "No image" }, { status: 400 });
    }
    base64 = raw.includes(",") ? raw.split(",", 2)[1] : raw;
  }

  try {
    const result = await callDeepFace(base64);

    if ("error" in result && result.error) {
      return NextResponse.json({
        source: "Face Analysis",
        deepface: { error: result.error },
      });
    }

    return NextResponse.json({
      source: "Face Analysis",
      deepface: result.data,
    });
  } catch (err) {
    const message = String(err);
    const offline =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("AbortError");

    return NextResponse.json({
      source: "Face Analysis",
      deepface: {
        error: offline
          ? process.env.VERCEL
            ? "Face server unavailable — deploy python/face_server.py separately and set FACE_SERVER_URL"
            : "Face server offline — run: npm run face (or npm run dev)"
          : message,
      },
    });
  }
}
