import Parser from "rss-parser";

import { NewsType } from "@/types/components";

interface RSSItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  pubDate?: string;
  creator?: string;
  enclosure?: {
    url?: string;
    type?: string;
  };
  "content:encoded"?: string;
}

const parser = new Parser<Record<string, never>, RSSItem>();

// Default avatar image when RSS feed doesn't provide one
const DEFAULT_AVATAR_URL =
  "/images/bavnalx9/production/325b9d4caf99511d5907bef5a11fd8f300c67e71-400x400.png";

// Default article image when RSS feed doesn't provide one
const DEFAULT_ARTICLE_IMAGE_URL = "/images/news/recall_network_2.avif";

/**
 * Extracts image URL from HTML content or RSS enclosure
 */
function extractImageFromContent(
  content?: string,
  enclosure?: RSSItem["enclosure"],
): string {
  // First, check if there's an enclosure with an image
  if (enclosure?.url && enclosure.type?.startsWith("image/")) {
    // Remove any existing query parameters as the News component will add its own
    return enclosure.url.split("?")[0] ?? enclosure.url;
  }

  // Try to extract image from content HTML
  if (content) {
    // Look for img tags
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch?.[1]) {
      // Remove any existing query parameters
      return imgMatch[1].split("?")[0] ?? imgMatch[1];
    }

    // Look for image URLs in the content
    const imageUrlMatch = content.match(
      /https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp)/i,
    );
    if (imageUrlMatch?.[0]) {
      // Remove any existing query parameters
      return imageUrlMatch[0].split("?")[0] ?? imageUrlMatch[0];
    }
  }

  return DEFAULT_ARTICLE_IMAGE_URL;
}

/**
 * Strips HTML tags and truncates text to a reasonable length
 */
function cleanAndTruncateText(html?: string, maxLength: number = 200): string {
  if (!html) return "";

  // Strip HTML tags
  const text = html.replace(/<[^>]*>/g, "");

  // Decode HTML entities
  const textarea =
    typeof document !== "undefined" ? document.createElement("textarea") : null;
  const decodedText = textarea
    ? ((textarea.innerHTML = text), textarea.value)
    : text;

  // Truncate and add ellipsis if needed
  if (decodedText.length > maxLength) {
    return decodedText.substring(0, maxLength).trim() + "...";
  }

  return decodedText.trim();
}

/**
 * Formats a date string to match the format used in home.json (e.g., "Aug 28 2025")
 */
function formatDate(dateString?: string): string {
  if (!dateString)
    return new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Fetches RSS feed and converts to NewsType format
 */
export async function fetchRSSNews(
  feedUrl: string,
  limit: number = 4,
): Promise<NewsType[]> {
  try {
    const feed = await parser.parseURL(feedUrl);

    // Take only the latest items based on limit
    const items = feed.items.slice(0, limit);

    return items.map((item, index): NewsType => {
      const imageUrl = extractImageFromContent(
        item["content:encoded"] || item.content,
        item.enclosure,
      );
      const text = cleanAndTruncateText(
        item.contentSnippet || item.content || item["content:encoded"],
      );

      return {
        _id: item.guid || `rss-${Date.now()}-${index}`,
        _type: "news",
        text: text.replace(/\n/g, "\n"), // Preserve line breaks for the component
        source: item.link || "",
        image: {
          url: imageUrl,
          width: 1200, // Default dimensions since RSS doesn't provide them
          height: 630,
        },
        meta: {
          date: formatDate(item.pubDate),
          image: {
            url: DEFAULT_AVATAR_URL, // Using default Recall avatar
            width: 400,
            height: 400,
          },
          title: "@recall", // Default to @recall since it's from their blog
        },
      };
    });
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    return []; // Return empty array on error
  }
}
