import { redirect } from "next/navigation";

// La primera pestaña es la cartelera: es la única con caducidad: un pase de
// esta noche no sirve mañana.
export default function DescubrirPage() {
  redirect("/descubrir/cartelera");
}
