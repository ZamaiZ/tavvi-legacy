import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // A DAL e a unica porta para o banco. Esta regra nao e usada como portao
  // de verificacao (decisao do cliente: sem lint), mas o editor a mostra
  // inline e ela documenta a fronteira de forma executavel.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/dal/_client.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@supabase/*", "@supabase/**"],
          message:
            "Apenas src/server/dal/_client.ts importa @supabase/*. Use uma funcao da DAL.",
        }],
      }],
    },
  },

  // Componente cliente e hook nunca alcancam a DAL nem as primitivas de
  // seguranca. As server actions sao a excecao deliberada: e exatamente
  // para isso que elas existem, e a diretiva use server garante que o corpo
  // nunca vai para o pacote do navegador.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: [
            "@/server/dal", "@/server/dal/*",
            "@/server/security", "@/server/security/*",
          ],
          message:
            "Componentes e hooks nao importam a DAL nem security. Receba dados por props ou chame uma server action de @/server/actions.",
        }],
      }],
    },
  },
]);

export default eslintConfig;
