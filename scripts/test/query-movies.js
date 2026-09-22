const { PrismaClient } = require("../../lib/generated/prisma");
const db = new PrismaClient();

async function main() {
  const all = await db.movie.findMany();
  const withTrailer = all.filter(m => m.trailerKey !== null);
  console.log(`Total movies: ${all.length}`);
  console.log(`Movies with trailerKey: ${withTrailer.length}`);
  if (withTrailer.length > 0) {
    console.log("Some movies with trailers:");
    withTrailer.slice(0, 5).forEach(m => {
      console.log(`- "${m.title}" (IMDb: ${m.imdbId}, trailerKey: "${m.trailerKey}")`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => db.$disconnect());
