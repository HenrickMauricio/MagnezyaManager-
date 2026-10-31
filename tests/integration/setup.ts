/**
 * Testes de integração: correm contra a base de dados de TESTE
 * (TEST_DATABASE_URL), nunca contra a de desenvolvimento.
 * Importar este módulo antes de qualquer serviço.
 */
import "dotenv/config";
import os from "node:os";
import path from "node:path";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Defina TEST_DATABASE_URL no .env (ver .env.example).");
if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL não pode ser a base de dados de desenvolvimento.");
process.env.DATABASE_URL = url;

// Ficheiros gerados nos testes (PDFs, fotografias) numa pasta temporária, fora do projeto.
process.env.STORAGE_DIR = path.join(os.tmpdir(), "magnezya-test-storage");
