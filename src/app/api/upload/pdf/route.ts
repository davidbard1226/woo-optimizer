import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), ".upload-cache");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const name = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    const filePath = path.join(UPLOAD_DIR, name);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    let text = "";
    try {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      text = data.text || "";
    } catch {
      text = "[PDF uploaded but text extraction failed. Install pdf-parse dependency.]";
    }

    if (!text.trim()) {
      text = "[No extractable text found in PDF]";
    }

    const html = text
      .split("\n")
      .filter((l: string) => l.trim())
      .map((l: string) => `<p>${l.trim()}</p>`)
      .join("\n");

    return NextResponse.json({ success: true, text: html, raw: text });
  } catch (error) {
    console.error("[upload/pdf] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF upload failed" },
      { status: 500 }
    );
  }
}
