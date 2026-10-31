# Magnezya – Event Support Management System

Plataforma de gestão de aluguer de mobiliário e equipamentos para eventos:
inventário, disponibilidade, reservas, orçamentos e portal do cliente.

Projeto próprio, pensado para ser vendido a empresas de aluguer em Portugal
(**uma instalação por empresa**, com a marca de cada uma). A marca e o catálogo
de demonstração são da Magnezya, usados com autorização.

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
npm run db:seed                          # dados de demonstração (catálogo Magnezya)
npm run catalogo:imagens                 # opcional: fotografias do catálogo (~1 min, 55 MB)
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

### Novas contas

Os administradores criam contas em **Utilizadores** com uma palavra-passe temporária
(botão "Gerar"), que deve ser comunicada ao utilizador por um canal seguro. No primeiro
login, o utilizador é obrigado a definir a sua. O mesmo acontece depois de "Repor palavra-passe".
Contas do portal de clientes criam-se a partir da ficha do cliente ("Acesso ao portal → Criar").

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes unitários |
| `npm run test:integration` | Testes com base de dados (motor, concorrência) — usam `TEST_DATABASE_URL`, nunca a BD de desenvolvimento |
| `npm run typecheck` | Verificação de tipos TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Build de produção |
| `npm run db:up` / `db:down` | Arrancar / parar a base de dados |
| `npm run db:migrate` | Criar/aplicar migrations após alterar o schema |
| `npm run db:seed` | Repor dados de demonstração (idempotente) |
| `npm run db:reset` | **Apaga** a base de dados local e volta a criar tudo |
| `npm run db:studio` | Explorar a base de dados no browser |
| `npm run catalogo:importar` | Atualizar `prisma/data/catalogo-magnezya.json` a partir de magnezya.pt |
| `npm run catalogo:imagens` | Descarregar as fotografias do catálogo (só artigos sem fotografias) |
| `npm run pdfs:regenerar` | Recuperar PDFs de propostas cujo ficheiro desapareceu (a partir do snapshot; `-- --ver` só lista) |


## Marca (white-label)

O nome e o subtítulo da marca vêm de `src/config/brand.ts` e mudam por instalação, no `.env`,
antes do build:

```
NEXT_PUBLIC_BRAND_NAME="Nome da Empresa"
NEXT_PUBLIC_BRAND_TAGLINE="Aluguer para eventos"
NEXT_PUBLIC_BRAND_SEGMENTS="Casamentos,Empresas,Feiras"
NEXT_PUBLIC_BRAND_HEADLINE="Frase principal da página de login"
NEXT_PUBLIC_BRAND_DESCRIPTION="Texto de apoio da página de login"
```

Sem estas variáveis, usa a marca de demonstração (Magnezya). Os dados legais e o logótipo para as
propostas ficarão nas Definições da empresa (Fase 5).

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
- Auditoria de logins, logouts, tentativas falhadas e de todas as alterações a clientes e utilizadores (`audit_logs`).
- Desativar uma conta termina de imediato as suas sessões; nunca pode ficar sem administradores ativos.
- Arquivar um cliente desativa as contas do portal desse cliente.
- Portal: cada cliente só vê as suas propostas e reservas (filtro pelo cliente da sessão em todas
  as queries); propostas de outros clientes respondem "não encontrado" (404).
- Fotografias servidas apenas a utilizadores com sessão e permissão (`/api/ficheiros/...`);
  metadados (ex.: localização GPS) removidos no carregamento.

### Orçamentos

- Preço por dia × dias do evento (início → fim, inclusive) ou por evento; desconto por linha e
  global; serviços adicionais; IVA calculado por taxa sobre a base tributável. Totais sempre
  recalculados no servidor.
- Desconto acima do limite de quem emite → "A aguardar aprovação" de um administrador.
- Vendedores veem todos os orçamentos e editam só os seus.
- **Emitir** congela uma versão (snapshot + PDF guardado com SHA-256). Versões antigas nunca
  mudam; editar um orçamento emitido cria a versão seguinte.
- **Aprovado pelo cliente** (registado pela equipa) reserva o stock na hora; se faltar material, a aprovação é recusada.
- Dados da empresa, logótipo, condições e serviços em **Definições** (aparecem no PDF).

### Portal do cliente

- O cliente vê as propostas já emitidas (nunca rascunhos), a última versão enviada, o histórico de
  versões e descarrega os PDFs guardados.
- **Aprovar** exige aceitar as condições e responder à versão atual; fica registado quem, quando,
  a versão e o IP. A reserva é criada na hora; se entretanto faltar stock, fica em
  **Conflito de stock** e a equipa confirma ("Confirmar reserva") quando houver material.
- **Recusar** regista o motivo (opcional), quem, quando e o IP.
- Propostas em revisão, expiradas ou já respondidas não aceitam resposta.
- A equipa vê as respostas no painel ("Respostas de clientes") e na ficha do orçamento.

### Catálogo e stock

- O stock de um artigo = **stock inicial** (definido ao criar) **+ movimentos** (entrada, abate,
  ajuste). O stock nunca se edita diretamente; cada movimento fica registado com motivo, data e autor.
- **Disponibilidade** (calculada, nunca guardada): stock total − reservas/alugueres (da entrega à
  recolha + dias de preparação da categoria) − manutenção, dia a dia; o disponível de um período é o
  mínimo dos dias. Devoluções parciais libertam só o que voltou; alugueres em atraso continuam a
  ocupar até a devolução ser registada.
- Reservar bloqueia os artigos e recalcula na mesma transação: pedidos simultâneos nunca
  ultrapassam o stock.
- Unidades em **manutenção** deixam de contar como disponíveis até a manutenção ser concluída; as
  unidades perdidas são abatidas automaticamente.
- O sistema recusa movimentos que deixariam o stock negativo ou abaixo das unidades em manutenção.
- Fotografias: reduzidas para WebP (máx. 1600 px + miniatura) e guardadas em `STORAGE_DIR`
  (pasta `storage/`, fora do Git). Em produção passará a S3/R2 na UE (Fase 8).

## Estado

- [x] **Fase 1** — estrutura, base de dados, autenticação, permissões, tema claro/escuro, layout
- [x] **Fase 2** — dashboard, utilizadores e clientes
- [~] **Fase 3** — artigos e inventário *(falta o importador de planilhas CSV/Excel)*
- [x] **Fase 4** — motor de disponibilidade, reservas diretas, calendário
- [x] **Fase 5** — orçamentos (construtor, descontos com limite, IVA por taxa, aprovação → reserva)
- [x] **Fase 6** — PDF e versões imutáveis (envio por email descartado: o PDF é enviado pelo programa de email do vendedor)
- [x] **Fase 7** — portal do cliente (propostas, PDF, aprovar/recusar com registo, reservas, conta)
- [ ] Fase 8 — testes, segurança e produção
