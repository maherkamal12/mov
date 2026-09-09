import { NextRequest, NextResponse } from "next/server";
import { isDbAvailable, pool } from "@/db";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/import-data?step=1 (or 2,3,4,5,6,7,8,9)
 * Reads embedded JSON data and imports it into Supabase.
 *
 * Step 1: Create tables + import categories
 * Step 2-5: Import movies (4 parts)
 * Step 6-9: Import links (4 parts)
 */
export async function GET(request: NextRequest) {
  if (!isDbAvailable() || !pool) {
    return NextResponse.json(
      { success: false, error: "DATABASE_URL is not set." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const step = parseInt(searchParams.get("step") || "1", 10);

  const steps: string[] = [];

  try {
    // Step 1: Create tables + categories
    if (step === 1) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, name_ar TEXT NOT NULL,
          total_pages INTEGER NOT NULL DEFAULT 1, last_scraped_page INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW()
        )`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug)`);
        await client.query(`CREATE TABLE IF NOT EXISTS movies (
          id SERIAL PRIMARY KEY, vid TEXT NOT NULL, title TEXT NOT NULL, image TEXT, duration TEXT,
          year INTEGER, source_url TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
        )`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS movies_vid_idx ON movies(vid)`);
        await client.query(`CREATE INDEX IF NOT EXISTS movies_year_idx ON movies(year)`);
        await client.query(`CREATE TABLE IF NOT EXISTS movie_categories (
          id SERIAL PRIMARY KEY, movie_vid TEXT NOT NULL, category_slug TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
        )`);
        await client.query(`CREATE INDEX IF NOT EXISTS mc_vid_idx ON movie_categories(movie_vid)`);
        await client.query(`CREATE INDEX IF NOT EXISTS mc_cat_idx ON movie_categories(category_slug)`);
        await client.query(`CREATE INDEX IF NOT EXISTS mc_cat_pos_idx ON movie_categories(category_slug, position)`);
        await client.query(`CREATE TABLE IF NOT EXISTS scraping_log (
          id SERIAL PRIMARY KEY, category_slug TEXT NOT NULL, page INTEGER NOT NULL DEFAULT 1,
          movies_count INTEGER NOT NULL DEFAULT 0, scraped_at TIMESTAMP DEFAULT NOW()
        )`);
        await client.query("COMMIT");
        steps.push("✅ Tables created");
      } catch (e) {
        await client.query("ROLLBACK");
        steps.push(`⚠️ Tables: ${e instanceof Error ? e.message : "error"}`);
      } finally {
        client.release();
      }

      // Import categories
      const data = await readJsonFile("categories.json");
      if (data) {
        const client = await pool.connect();
        let count = 0;
        try {
          for (const item of data) {
            const cat = item as Record<string, unknown>;
            await client.query(
              `INSERT INTO categories (slug, name, name_ar, total_pages, last_scraped_page) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (slug) DO UPDATE SET total_pages=$4, last_scraped_page=$5`,
              [cat.slug, cat.name, cat.name_ar, cat.total_pages, cat.last_scraped_page]
            );
            count++;
          }
          steps.push(`✅ Imported ${count} categories`);
        } finally {
          client.release();
        }
      }
    }

    // Steps 2-5: Import movies
    if (step >= 2 && step <= 5) {
      const part = step - 1; // movies1.json, movies2.json, etc.
      const data = await readJsonFile(`movies${part}.json`);
      if (data) {
        const client = await pool.connect();
        let count = 0;
        try {
          for (const item of data) {
            const movie = item as Record<string, unknown>;
            await client.query(
              `INSERT INTO movies (vid, title, image, duration, year, source_url) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (vid) DO UPDATE SET title=$2, image=$3, duration=$4, year=$5, updated_at=NOW()`,
              [movie.vid, movie.title, movie.image, movie.duration, movie.year, movie.source_url]
            );
            count++;
          }
          steps.push(`✅ Imported ${count} movies (part ${part})`);
        } finally {
          client.release();
        }
      } else {
        steps.push(`⚠️ No data file found for movies part ${part}`);
      }
    }

    // Steps 6-9: Import links
    if (step >= 6 && step <= 9) {
      const part = step - 5; // links1.json, links2.json, etc.
      const data = await readJsonFile(`links${part}.json`);
      if (data) {
        const client = await pool.connect();
        let count = 0;
        try {
          for (const item of data) {
            const link = item as Record<string, unknown>;
            await client.query(
              `INSERT INTO movie_categories (movie_vid, category_slug, position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
              [link.movie_vid, link.category_slug, link.position]
            );
            count++;
          }
          steps.push(`✅ Imported ${count} links (part ${part})`);
        } finally {
          client.release();
        }
      } else {
        steps.push(`⚠️ No data file found for links part ${part}`);
      }
    }

    // Get current movie count
    let movieCount = 0;
    try {
      const client = await pool.connect();
      try {
        const r = await client.query(`SELECT count(*)::int as c FROM movies`);
        movieCount = r.rows[0]?.c || 0;
      } finally {
        client.release();
      }
    } catch { /* ignore */ }

    const nextStep = step < 9 ? step + 1 : 0;
    return NextResponse.json({
      success: true,
      steps,
      totalMovies: movieCount,
      nextStep,
      message: nextStep > 0
        ? `Step ${step} done. Now visit /api/import-data?step=${nextStep}`
        : `All done! ${movieCount} movies in database.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    steps.push(`❌ Error: ${msg}`);
    return NextResponse.json({ success: false, error: msg, steps }, { status: 500 });
  }
}

async function readJsonFile(filename: string): Promise<unknown[] | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "sql", filename);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
