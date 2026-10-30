# Magnezya – Event Support Management System

Plataforma de gestão de aluguer de mobiliário e equipamentos para eventos:
inventário, disponibilidade, reservas, orçamentos e portal do cliente.

Plano técnico e decisões: [`docs/PLANO-TECNICO.md`](docs/PLANO-TECNICO.md)

## Requisitos

- Node.js 20.19 ou superior (testado com 22 LTS e 26)
- Docker Desktop (para o PostgreSQL local)
- Git

## Primeira instalação (Windows / PowerShell)

Abrir o PowerShell **dentro da pasta do projeto**:

```powershell
cd "C:\Users\Henrick\Desktop\MAGNEZYA PROJECT"

npm install                              # dependências (+ gera o cliente Prisma)
npm run db:up                            # arranca o PostgreSQL no Docker (porta 5433)
npx prisma migrate dev --name init       # cria as tabelas
npm run db:seed                          # dados de demonstração
npm test                                 # testes unitários
npm run dev                              # http://localhost:3000
```

> O Docker Desktop tem de estar aberto antes de `npm run db:up`. Logo após instalar o Docker,
> feche e volte a abrir o terminal (ou o VS Code) para o comando `docker` ficar no PATH.

## Contas de demonstração

Palavra-passe de todas: `Magnezya#2026` (definida em `SEED_DEFAULT_PASSWORD` no `.env`).

| Perfil | Email | Área |
|---|---|---|
| Administrador | admin@magnezya.test | /painel |
| Vendedor | vendedor@magnezya.test | /painel |
| Vendedora 2 | vendedor2@magnezya.test | /painel |
| Cliente (Alfa) | cliente@alfa.example | /portal |
| Cliente (Beta) | cliente@beta.example | /portal |

Estas contas existem apenas em desenvolvimento. Nunca executar o seed em produção.

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes unitários |
| `npm run typecheck` | Verificação de tipos TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Build de produção |
| `npm run db:up` / `db:down` | Arrancar / parar a base de dados |
| `npm run db:migrate` | Criar/aplicar migrations após alterar o schema |
| `npm run db:seed` | Repor dados de demonstração (idempotente) |
| `npm run db:reset` | **Apaga** a base de dados local e volta a criar tudo |
| `npm run db:studio` | Explorar a base de dados no browser |

## Arquitetura (resumo)

```
src/
  app/            páginas (App Router): (auth) login · (admin) área interna · (portal) clientes
  components/     UI: ui/ (botões, campos, cards) · layout/ (sidebar, menu)
  server/
    auth/         Better Auth + sessão + guardas de permissão
    actions/      Server Actions (finas: validar → autorizar → chamar serviço)
    services/     regras de negócio (dashboard, portal, auditoria, …)
    db.ts         cliente Prisma
  lib/            código partilhado: permissões, formatação pt-PT, validação Zod
prisma/           schema, migrations, seed
tests/unit/       testes (node:test via tsx)
```

### Segurança

- Palavras-passe com hash (scrypt, Better Auth); sessões na base de dados, revogáveis.
- Registo público desativado; contas inativas não conseguem iniciar sessão.
- Três níveis de proteção: `src/proxy.ts` (sessão) → layouts/páginas (papel) →
  Server Actions e serviços (permissão + filtro por cliente nas queries).
- Limite de 5 tentativas de login por minuto.
- Auditoria de logins, logouts e tentativas falhadas (`audit_logs`).

## Estado

- [x] **Fase 1** — estrutura, base de dados, autenticação, permissões, tema claro/escuro, layout
- [ ] Fase 2 — dashboard, utilizadores e clientes
- [ ] Fase 3 — artigos e inventário
- [ ] Fase 4 — motor de disponibilidade e calendário
- [ ] Fase 5 — orçamentos
- [ ] Fase 6 — PDF e email
- [ ] Fase 7 — portal do cliente
- [ ] Fase 8 — testes, segurança e produção
