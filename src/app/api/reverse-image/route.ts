import { NextRequest, NextResponse } from "next/server";
import { runReverseImageSearch } from "@/lib/modules/reverseImage";

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
    return NextResponse.json({ error: String(err) }, { status: 422 });
  }
}
