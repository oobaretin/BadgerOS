import { NextRequest, NextResponse } from "next/server";
import { runReverseImageSearch } from "@/lib/modules/reverseImage";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const image = formData.get("image");
  const imageUrl = formData.get("url");

  const imageBlob = image instanceof Blob && image.size > 0 ? image : undefined;
  const url = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : undefined;

  if (!imageBlob && !url) {
    return NextResponse.json({ error: "Provide an image file or URL" }, { status: 400 });
  }

  try {
    const data = await runReverseImageSearch({ image: imageBlob, imageUrl: url });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        source: "Reverse Image Search",
        error: message,
        manualLinks: {},
      },
      { status: 200 }
    );
  }
}
