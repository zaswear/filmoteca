import { redirect } from "next/navigation";

// Las gráficas son ahora la mitad de abajo de /balance.
export default function Redirigir() {
  redirect("/balance");
}
