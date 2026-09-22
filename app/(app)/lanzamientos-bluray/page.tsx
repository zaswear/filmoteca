import { redirect } from "next/navigation";

// La fuente vive ahora como pestaña de Descubrir. La ruta vieja se conserva
// redirigiendo porque está en enlaces guardados y en el historial.
export default function Redirigir() {
  redirect("/descubrir/bluray");
}
