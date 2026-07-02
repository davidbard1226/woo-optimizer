import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/woocommerce";
import { ImageAuditResult, ImageIssue } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("per_page") || "50");

    const { products } = await fetchProducts({ page, per_page: perPage, status: "publish" });

    const results: ImageAuditResult[] = products.map((product) => {
      const issues: ImageIssue[] = [];

      if (!product.images || product.images.length === 0) {
        issues.push({
          imageId: 0,
          imageSrc: "",
          type: "no_images",
          severity: "critical",
          message: "Product has no images",
        });
      } else {
        for (const image of product.images) {
          if (!image.alt || image.alt.trim() === "") {
            issues.push({
              imageId: image.id,
              imageSrc: image.src,
              type: "empty_alt",
              severity: "critical",
              message: `Image "${image.name}" has no alt text`,
            });
          }

          try {
            new URL(image.src);
          } catch {
            issues.push({
              imageId: image.id,
              imageSrc: image.src,
              type: "broken_url",
              severity: "warning",
              message: `Image URL appears invalid: ${image.src}`,
            });
          }
        }
      }

      return {
        productId: product.id,
        productName: product.name,
        issues,
      };
    });

    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const productsWithIssues = results.filter((r) => r.issues.length > 0).length;

    return NextResponse.json({
      results,
      summary: { totalProducts: results.length, productsWithIssues, totalIssues },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image audit failed" },
      { status: 500 }
    );
  }
}
