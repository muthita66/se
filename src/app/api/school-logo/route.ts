import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    const filePath = "C:\\Users\\ACER NITRO\\.gemini\\antigravity\\brain\\22bcbfdc-853f-48f2-aa62-147b3b9859f3\\school_logo_png_1774671232726.png";

    try {
        if (!fs.existsSync(filePath)) {
            return new NextResponse("File not found", { status: 404 });
        }
        const fileContent = fs.readFileSync(filePath);
        return new NextResponse(fileContent, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (err) {
        return new NextResponse("Error reading file", { status: 500 });
    }
}
