-- CreateTable
CREATE TABLE "movies" (
    "id" SERIAL NOT NULL,
    "imdb_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "year" INTEGER,
    "release_date" TIMESTAMP(3),
    "duration_min" INTEGER,
    "genres" TEXT NOT NULL DEFAULT '[]',
    "directors" TEXT NOT NULL DEFAULT '[]',
    "cast" TEXT NOT NULL DEFAULT '[]',
    "plot" TEXT,
    "poster_url" TEXT,
    "imdb_rating" DOUBLE PRECISION,
    "imdb_votes" INTEGER,
    "country" TEXT,
    "language" TEXT,
    "rated" TEXT,
    "trailer_key" TEXT,
    "my_rating" DOUBLE PRECISION,
    "watched_at" TIMESTAMP(3),
    "watch_format" TEXT,
    "review" TEXT,
    "has_imdb_review" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "visual_tone" TEXT,
    "imported_from_imdb" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" SERIAL NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "public_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'gallery',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viewings" (
    "id" SERIAL NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "watched_at" TIMESTAMP(3) NOT NULL,
    "my_rating" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bluray_purchases" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "poster_url" TEXT,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bluray_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cinema_movies" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "poster_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cinema_movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cinema_showtimes" (
    "id" SERIAL NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "cinema_name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ticket_url" TEXT,

    CONSTRAINT "cinema_showtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_credential" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CollectionToMovie" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "movies_imdb_id_key" ON "movies"("imdb_id");

-- CreateIndex
CREATE INDEX "movies_status_idx" ON "movies"("status");

-- CreateIndex
CREATE INDEX "movies_watched_at_idx" ON "movies"("watched_at");

-- CreateIndex
CREATE INDEX "movies_my_rating_idx" ON "movies"("my_rating");

-- CreateIndex
CREATE INDEX "movies_year_idx" ON "movies"("year");

-- CreateIndex
CREATE INDEX "images_movie_id_idx" ON "images"("movie_id");

-- CreateIndex
CREATE INDEX "viewings_movie_id_idx" ON "viewings"("movie_id");

-- CreateIndex
CREATE INDEX "viewings_watched_at_idx" ON "viewings"("watched_at");

-- CreateIndex
CREATE UNIQUE INDEX "collections_name_key" ON "collections"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cinema_movies_title_key" ON "cinema_movies"("title");

-- CreateIndex
CREATE INDEX "cinema_showtimes_movie_id_idx" ON "cinema_showtimes"("movie_id");

-- CreateIndex
CREATE INDEX "cinema_showtimes_date_idx" ON "cinema_showtimes"("date");

-- CreateIndex
CREATE INDEX "cinema_showtimes_city_idx" ON "cinema_showtimes"("city");

-- CreateIndex
CREATE INDEX "cinema_showtimes_cinema_name_idx" ON "cinema_showtimes"("cinema_name");

-- CreateIndex
CREATE UNIQUE INDEX "_CollectionToMovie_AB_unique" ON "_CollectionToMovie"("A", "B");

-- CreateIndex
CREATE INDEX "_CollectionToMovie_B_index" ON "_CollectionToMovie"("B");

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cinema_showtimes" ADD CONSTRAINT "cinema_showtimes_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "cinema_movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionToMovie" ADD CONSTRAINT "_CollectionToMovie_A_fkey" FOREIGN KEY ("A") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionToMovie" ADD CONSTRAINT "_CollectionToMovie_B_fkey" FOREIGN KEY ("B") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

