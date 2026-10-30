/**
 * Carregado com --require nos testes de integração: os serviços importam
 * "server-only", que fora do Next.js lança um erro de propósito. Nos testes
 * (Node puro) é substituído por um módulo vazio; a aplicação não é afetada.
 */
const Module = require("node:module");
const path = require("node:path");

const stub = path.join(__dirname, "server-only-stub.cjs");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return stub;
  return resolve.call(this, request, ...rest);
};
