import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { credencialCambiadaEn, verificarAdmin } from "@/lib/admin-credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      // La comprobación vive en lib/admin-credentials.ts: credencial en la base
      // de datos, hash scrypt, comparación de tiempo constante y límite de
      // intentos por IP.
      async authorize(credentials, req) {
        const ip =
          (req?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
          null;
        return verificarAdmin({
          usuario: credentials?.username,
          password: credentials?.password,
          ip,
        });
      },
    }),
  ],
  callbacks: {
    /**
     * Invalida las sesiones abiertas al cambiar la contraseña.
     *
     * El token guarda `pwdAt`, la marca del último cambio en el momento de
     * entrar. En cada comprobación de sesión se compara con la de la base: si
     * no coincide, este callback LANZA. NextAuth v4 no deja devolver null aquí,
     * pero la ruta de sesión envuelve la llamada en un try/catch que borra la
     * cookie y devuelve un cuerpo vacío → `getServerSession` da null. Es decir:
     * lanzar es la forma soportada de cerrar la sesión desde aquí.
     *
     * Sin esto, cambiar la contraseña no echa a quien ya estuviera dentro, que
     * es justo lo que se quiere cuando el motivo del cambio es que alguien
     * entró.
     */
    async jwt({ token, user }) {
      if (user) {
        token.pwdAt = (user as { pwdAt?: number }).pwdAt ?? 0;
        return token;
      }
      let actual: number;
      try {
        actual = await credencialCambiadaEn();
      } catch (err) {
        // Una base dormida o caída no debe cerrar la sesión de nadie: el
        // compute free de Neon se apaga solo. Se mantiene el token y se
        // reintenta en la siguiente petición.
        console.error("[auth] no se pudo comprobar la credencial:", err);
        return token;
      }
      if ((token.pwdAt as number | undefined) !== actual) {
        throw new Error("credencial cambiada: sesión invalidada");
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
    // 7 días. Eran 30: una sesión de administrador robada duraba un mes.
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
