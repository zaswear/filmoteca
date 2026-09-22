import { MovieForm } from "@/components/movies/movie-form";

export const metadata = { title: "Nueva película" };

export default function NuevaPeliculaPage() {
  return <MovieForm mode="create" />;
}
