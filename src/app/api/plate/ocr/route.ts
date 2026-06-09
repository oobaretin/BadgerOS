import { NextRequest, NextResponse } from "next/server";
import { runPlateOcr } from "@/lib/modules/plateOcr";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const image = formData.get("image");
  const countryRaw = formData.get("country");
  const country = countryRaw === "uk" ? "uk" : "us";

  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 10 MB or smaller" }, { status: 400 });
  }

  const data = await runPlateOcr(image, { country });

  if (data.error) {
    return NextResponse.json(data, { status: 422 });
  }

  return NextResponse.json(data);
}
