import * as cheerio from "cheerio";

const BASE_URL = "https://a.qfilm.tv";

export interface ScrapedMovie {
  vid: string;
  title: string;
  image: string;
  duration: string;
  sourceUrl: string;
  year: number | null;
}

export interface ScrapedPage {
  movies: ScrapedMovie[];
  totalPages: number;
  currentPage: number;
}

export async function scrapeMoviesPage(
  category: string = "arabic-movies",
  page: number = 1
): Promise<ScrapedPage> {
  const url = `${BASE_URL}/category.php?cat=${category}&page=${page}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "ar,en-US;q=0.7,en;q=0.3",
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const movies: ScrapedMovie[] = [];

  // Parse movie items from pm-grid
  $("#pm-grid > li").each((_, li) => {
    const $li = $(li);

    // Get movie link and vid
    const linkEl = $li.find('a[href*="watch.php?vid="]').first();
    const href = linkEl.attr("href") || "";
    const vidMatch = href.match(/vid=([a-zA-Z0-9]+)/);
    const vid = vidMatch ? vidMatch[1] : "";

    if (!vid) return;

    // Get title from h3.caption
    const title = $li.find("h3.caption").text().trim();

    // Get image from data-echo attribute (lazy loading)
    const imgEl = $li.find("img[data-echo]");
    const image = imgEl.attr("data-echo") || imgEl.attr("src") || "";

    // Get duration
    const duration = $li.find(".pm-label-duration").text().trim();

    // Build source URL
    const sourceUrl = `${BASE_URL}/watch.php?vid=${vid}`;

    if (title) {
      let cleanTitle = title.replace(/\s+/g, " ").trim();
      // Strip source site branding
      cleanTitle = cleanTitle.replace(/\s*[-–—]\s*كيو فيلم\s*/g, "").replace(/كيو فيلم/g, "").trim();
      // Extract year from title:
      //   "فيلم رمادي (2026)" → 2026
      //   "فيلم Parasomnia 2025 مترجم" → 2025
      const parenYear = cleanTitle.match(/\((\d{4})\)/);
      const plainYear = cleanTitle.match(/(?:^|\s)(\d{4})(?:\s|$)/);
      const rawYear = parenYear?.[1] || plainYear?.[1];
      const year =
        rawYear && parseInt(rawYear, 10) >= 1930 && parseInt(rawYear, 10) <= 2030
          ? parseInt(rawYear, 10)
          : null;

      movies.push({
        vid,
        title: cleanTitle,
        image: image.startsWith("http") ? image : `${BASE_URL}${image}`,
        duration,
        sourceUrl,
        year,
      });
    }
  });

  // Sort: newest movies first (year descending), movies without year go last
  movies.sort((a, b) => {
    if (a.year !== null && b.year !== null) return b.year - a.year;
    if (a.year !== null) return -1;
    if (b.year !== null) return 1;
    return 0;
  });

  // Parse pagination to get total pages
  let totalPages = 1;
  const paginationLinks = $("ul.pagination li a");
  paginationLinks.each((_, el) => {
    const pageNum = parseInt($(el).text().trim(), 10);
    if (!isNaN(pageNum) && pageNum > totalPages) {
      totalPages = pageNum;
    }
  });

  // Also check for direct last page link
  const lastPageHref = paginationLinks.last().attr("href");
  if (lastPageHref) {
    const pageMatch = lastPageHref.match(/page=(\d+)/);
    if (pageMatch) {
      const lastPage = parseInt(pageMatch[1], 10);
      if (lastPage > totalPages) {
        totalPages = lastPage;
      }
    }
  }

  return {
    movies,
    totalPages,
    currentPage: page,
  };
}

export async function scrapeMovieDetail(vid: string) {
  const url = `${BASE_URL}/watch.php?vid=${vid}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "ar,en-US;q=0.7,en;q=0.3",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch movie detail: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  let title = $('meta[property="og:title"]').attr("content") || "";
  let description = $('meta[property="og:description"]').attr("content") || "";
  const image = $('meta[property="og:image"]').attr("content") || "";
  const embedUrl = `${BASE_URL}/embed.php?vid=${vid}`;

  // Strip source site branding from title and description
  title = title.replace(/\s*[-–—]\s*كيو فيلم\s*/g, "").replace(/كيو فيلم/g, "").trim();
  description = description.replace(/\s*كيو فيلم\s*/g, "").trim();

  // Extract additional details
  const detailText = $(".pm-video-detail").text();

  return {
    vid,
    title,
    description,
    image: image.startsWith("http") ? image : `${BASE_URL}${image}`,
    embedUrl,
    sourceUrl: url,
    detailText,
  };
}

// ALL categories from the source site (27 categories, ~30,000 movies)
export const SOURCE_CATEGORIES = [
  { slug: "arabic-movies", name: "أفلام عربي", nameAr: "أفلام عربي" },
  { slug: "egyptian-movies", name: "أفلام مصرية", nameAr: "أفلام مصرية" },
  { slug: "foreign-movies", name: "أفلام أجنبي", nameAr: "أفلام أجنبي" },
  { slug: "indian-movies", name: "أفلام هندي", nameAr: "أفلام هندي" },
  { slug: "asian-movies", name: "أفلام آسيوية", nameAr: "أفلام آسيوية" },
  { slug: "turkish-movies", name: "أفلام تركية", nameAr: "أفلام تركية" },
  { slug: "anime-movies", name: "أفلام أنيميشن", nameAr: "أفلام أنيميشن" },
  { slug: "dubbed-movies", name: "أفلام مدبلجة", nameAr: "أفلام مدبلجة" },
  { slug: "2026-movies", name: "أفلام 2026", nameAr: "أفلام 2026" },
  { slug: "romance-movies", name: "رومانسي", nameAr: "رومانسي" },
  { slug: "drama-movies", name: "دراما", nameAr: "دراما" },
  { slug: "action-movies", name: "أكشن", nameAr: "أكشن" },
  { slug: "comedy-movies", name: "كوميدي", nameAr: "كوميدي" },
  { slug: "horror-movies", name: "رعب", nameAr: "رعب" },
  { slug: "thriller-movies", name: "تشويق وإثارة", nameAr: "تشويق وإثارة" },
  { slug: "adventure-movies", name: "مغامرات", nameAr: "مغامرات" },
  { slug: "crime-movies", name: "جريمة", nameAr: "جريمة" },
  { slug: "mystery-movies", name: "غموض", nameAr: "غموض" },
  { slug: "sci-fi-movies", name: "خيال علمي", nameAr: "خيال علمي" },
  { slug: "fantasy-movies", name: "فانتازيا", nameAr: "فانتازيا" },
  { slug: "war-movies", name: "حروب", nameAr: "حروب" },
  { slug: "documentary-movies", name: "وثائقي", nameAr: "وثائقي" },
  { slug: "family-movies", name: "عائلي", nameAr: "عائلي" },
  { slug: "biography-movies", name: "سيرة ذاتية", nameAr: "سيرة ذاتية" },
  { slug: "musical-movies", name: "موسيقي وغنائي", nameAr: "موسيقي وغنائي" },
  { slug: "historical-movies", name: "تاريخي", nameAr: "تاريخي" },
  { slug: "coming-soon", name: "يعرض قريبًا", nameAr: "يعرض قريبًا" },
  { slug: "ramadan-series", name: "مسلسلات رمضان", nameAr: "مسلسلات رمضان" },
];
