import { pgTable, text, serial, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  totalPages: integer("total_pages").notNull().default(1),
  lastScrapedPage: integer("last_scraped_page").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("categories_slug_idx").on(table.slug),
]);

export const movies = pgTable("movies", {
  id: serial("id").primaryKey(),
  vid: text("vid").notNull(),
  title: text("title").notNull(),
  image: text("image"),
  duration: text("duration"),
  year: integer("year"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("movies_vid_idx").on(table.vid),
  index("movies_year_idx").on(table.year),
]);

// Many-to-many: a movie can belong to multiple categories
export const movieCategories = pgTable("movie_categories", {
  id: serial("id").primaryKey(),
  movieVid: text("movie_vid").notNull(),
  categorySlug: text("category_slug").notNull(),
  position: integer("position").notNull().default(0), // order within category
}, (table) => [
  index("mc_vid_idx").on(table.movieVid),
  index("mc_cat_idx").on(table.categorySlug),
  index("mc_cat_pos_idx").on(table.categorySlug, table.position),
]);

export const scrapingLog = pgTable("scraping_log", {
  id: serial("id").primaryKey(),
  categorySlug: text("category_slug").notNull(),
  page: integer("page").notNull().default(1),
  moviesCount: integer("movies_count").notNull().default(0),
  scrapedAt: timestamp("scraped_at").defaultNow(),
});
