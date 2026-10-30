/** Aplica as migrações à base de dados de teste antes dos testes de integração. */
import "dotenv/config";
import { execSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Defina TEST_DATABASE_URL no .env (ver .env.example).");
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
