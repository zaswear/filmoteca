import { MovieForm } from "@/components/movies/movie-form";

import { t } from "@/lib/i18n";
export const metadata = { title: t("pend.nueva") };

export default function NuevaPeliculaPage() {
  return <MovieForm mode="create" />;
}
