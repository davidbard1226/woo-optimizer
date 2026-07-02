import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), ".upload-cache");

export async function POST(request: NextRequest) {
  try {
    console.log("[upload] Starting upload...");
    const formData = await request.formData();
    console.log("[upload] formData parsed");

    const file = formData.get("file") as File | null;
    if (!file) {
      console.log("[upload] No file in formData");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`[upload] File: ${file.name}, size: ${file.size}, type: ${file.type}`);

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      console.log(`[upload] Created dir: ${UPLOAD_DIR}`);
    }

    const ext = path.extname(file.name) || ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, name);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    console.log(`[upload] Saved to: ${filePath} (${buffer.length} bytes)`);

    const host = request.headers.get("host") || "localhost:3000";
    const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const url = `${proto}://${host}/api/uploads/${name}`;
    console.log(`[upload] Returning URL: ${url}`);

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("[upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
