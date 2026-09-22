import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Config ESLint de la app.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // scripts/ son utilidades Node (a menudo CommonJS con require), no código de
  // la app Next/TS — no se lintan con estas reglas.
  // lib/generated/** es el cliente Prisma: código generado, no se revisa.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**", "lib/generated/**"]),
  {
    // Severidades: los problemas de estilo/calidad son "warn" y los
    // que suelen delatar bugs siguen siendo "error". Cuidado con el "no
    // bloquea" histórico — las apps lintan con `eslint --max-warnings=0`, así
    // que cualquier warning es un error fatal en el CI/build. "warn" aquí solo
    // distingue la gravedad en el editor, no suelta el paso en CI.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      // Reglas del React Compiler (plugin react-hooks): útiles pero aún
      // estrictas/experimentales — como aviso, no bloquean el build.
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      // Esta regla vigila que las fuentes no se carguen desde una página suelta,
      // y para eso mira `pages/_document.js`. Con App Router ese fichero no
      // existe: el <link> va en el layout raíz, que es exactamente lo que la
      // regla pide. Aquí solo produce falsos positivos.
      "@next/next/no-page-custom-font": "off",
    },
  },
]);
