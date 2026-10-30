# Magnezya – Event Support Management System
## Plano técnico de implementação (v1 — para validação)

Data: 29/10/2026 · Estado: **aguarda validação** antes de qualquer alteração estrutural

---

## 1. Análise da pasta atual

A pasta `MAGNEZYA PROJECT` está **vazia**: não existe código, dependências, base de dados nem backend anterior. Não há nada a migrar — o projeto começa do zero, o que permite escolher a arquitetura sem compromissos herdados.

Informação recolhida em magnezya.pt (útil para o seed e para o catálogo):

- Marca: "Magnezya – Event Support"; segmentos Corporate, Feiras e Congressos.
- Logótipo existe em versão normal e versão branca (necessárias ambas: tema claro/escuro e PDF).
- O site não mostra NIF, morada, telefone nem email — **têm de ser fornecidos** para o PDF e para `CompanySettings`.
- Catálogo real (base para as categorias iniciais): Conjuntos lounge · Sofás e poltronas · Bancos e banquetas · Cadeiras · Mesas · Toalhas e camilhas · Balcões e bares · Iluminação LED e decoração · Palcos, estrados e estruturas (truss, barreiras, biombos) · Tendas, aquecedores, som e diversos.

---

## 2. Arquitetura proposta

**Monólito modular em Next.js (App Router)**, com o backend dentro da mesma aplicação mas separado em camadas. Para a dimensão da Magnezya (dezenas de utilizadores internos, centenas de clientes), um único deploy é mais simples de operar, mais barato e mais seguro do que frontend + API separados — e a separação em camadas deixa a porta aberta para extrair uma API mais tarde (ex.: app móvel de armazém).

```
┌──────────────────────────────────────────────────────────────┐
│  UI (React Server Components + Client Components)            │
│  app/(admin) · app/(portal) · app/(auth)                     │
├──────────────────────────────────────────────────────────────┤
│  Entrada: Server Actions  +  Route Handlers (PDF, uploads,   │
│  webhooks de email, aprovação por link)                      │
│  → autenticação · validação Zod · autorização por permissão  │
├──────────────────────────────────────────────────────────────┤
│  Camada de serviços / regras de negócio  (src/server/...)    │
│  availability · quotes · rentals · inventory · clients ·     │
│  users · pricing/tax · pdf · email · audit                   │
├──────────────────────────────────────────────────────────────┤
│  Acesso a dados: Prisma (transações, locks, queries)         │
├──────────────────────────────────────────────────────────────┤
│  PostgreSQL  ·  Armazenamento de ficheiros S3 (fotos, PDFs)  │
└──────────────────────────────────────────────────────────────┘
```

Regra central: **a UI nunca fala com o Prisma diretamente** e nenhuma regra de negócio vive em componentes. Cada Server Action é fina: `sessão → validar input (Zod) → verificar permissão → chamar serviço`. Os serviços recebem sempre o utilizador atual, para que o filtro por cliente/vendedor seja aplicado no servidor e não dependa do que a UI esconde.

### 2.1 Tecnologias

| Área | Escolha | Nota |
|---|---|---|
| Framework | **Next.js 16** (App Router), React 19, TypeScript estrito | versão estável atual |
| Estilos | **Tailwind CSS v4** + design tokens próprios (CSS variables) | tema claro/escuro por tokens |
| Componentes | **shadcn/ui sobre Radix** (acessível), totalmente redesenhado | os componentes ficam no código, sem aspeto de template |
| Ícones | Lucide (traço fino, 1.5px) | minimalistas |
| Tipografia | **Inter** (UI) + **Inter Tight** (títulos) ou Geist — a validar | próximo do estilo Uber Move, que não é licenciável |
| Base de dados | **PostgreSQL 16+** | |
| ORM | **Prisma 7** (migrations + seed) | |
| Autenticação | **Better Auth** (recomendado) ou Auth.js v5 — ver §2.2 | |
| Validação | Zod (partilhado entre formulário e servidor) | |
| Formulários | React Hook Form + Zod | |
| Tabelas | TanStack Table (ordenar, filtrar, paginar no servidor) | |
| Gráficos | Recharts | |
| Calendário | FullCalendar (vistas dia/semana/mês, núcleo MIT) | ver risco §6 |
| PDF | **@react-pdf/renderer** no servidor | layout fiel, sem browser headless |
| Email | React Email + Resend (ou SMTP do domínio magnezya.pt) | |
| Ficheiros | S3 compatível (Cloudflare R2 / AWS S3 região UE; MinIO em desenvolvimento) | fotos e PDFs emitidos |
| Datas | date-fns + `@date-fns/tz`, locale `pt`, fuso `Europe/Lisbon` | |
| Testes | Vitest (unitários/integração com Postgres real) + Playwright (E2E) | |
| Qualidade | ESLint, Prettier, Husky + lint-staged, CI no GitHub Actions | |

### 2.2 Autenticação: Auth.js vs Better Auth (decisão necessária)

Pediram Auth.js. Desde setembro de 2025 o Auth.js passou a ser mantido pela equipa do Better Auth, que recomenda Better Auth para projetos novos; o `next-auth` v5 continua em beta. Para este projeto, o Better Auth tem vantagens concretas:

- sessões guardadas na base de dados → **é possível revogar acessos** (ex.: desativar um vendedor que sai da empresa tem efeito imediato); com Auth.js + credenciais as sessões são JWT e isso exige código extra;
- login por email/palavra-passe com hash seguro nativo, recuperação de palavra-passe, verificação de email, rate limiting e 2FA opcional (útil para administradores);
- adaptador Prisma oficial.

**Recomendação: Better Auth.** Se preferirem manter Auth.js, é viável (JWT + `sessionVersion` na tabela User para invalidar sessões) — apenas mais código próprio.

Em ambos os casos, **as permissões são da aplicação** (tabelas Role/Permission), não da biblioteca de autenticação.

### 2.3 Autorização

- Três papéis base: `ADMIN`, `VENDEDOR`, `CLIENTE`. Cada papel tem um conjunto de permissões (`quote:create`, `quote:approve`, `article:write`, `report:view`, `discount:above_limit`…). O administrador pode ajustar permissões de um vendedor específico ("de acordo com as permissões atribuídas").
- Verificação em três níveis:
  1. `middleware/proxy` do Next.js — bloqueia áreas inteiras (`/admin/*` só para ADMIN/VENDEDOR, `/portal/*` só para CLIENTE);
  2. cada Server Action/Route Handler — `requirePermission(user, 'quote:approve')`;
  3. cada serviço — **filtro de propriedade nas queries** (`where: { clientId: user.clientId }` para clientes; `createdById` para vendedores quando aplicável). Um cliente que adivinhe o ID de outro orçamento recebe 404, não os dados.
- Limite de desconto por vendedor (ex.: 10%); acima disso o orçamento passa a "Aguardando aprovação" interna de um administrador.

---

## 3. Motor de disponibilidade (núcleo do sistema)

### 3.1 Princípios

- A disponibilidade **nunca é um campo guardado**: é calculada por artigo e por data a partir das reservas, alugueres em curso e manutenções.
- Um único serviço (`src/server/services/availability`) é a fonte de verdade, usado pelo gerador de orçamentos, pelo calendário, pelo dashboard e pela aprovação.
- Granularidade **diária**, datas inclusivas, fuso `Europe/Lisbon`.

### 3.2 O que ocupa stock

Um artigo está ocupado **desde a data de entrega/montagem até à data de recolha/devolução** (não só no período do evento), mais uma margem configurável de preparação/limpeza (ex.: 0–1 dia, por categoria).

| Origem | Ocupa stock? |
|---|---|
| Orçamento em Rascunho / Enviado | Não (apenas aparece como "procura pendente" — aviso, não bloqueio)* |
| Reserva (orçamento aprovado) | Sim |
| Aluguer em curso (entregue) | Sim |
| Aluguer com devolução em atraso | Sim, **até ser registada a devolução real** (o período estende-se automaticamente até hoje + projeção) |
| Devolução parcial | Só as unidades ainda não devolvidas |
| Manutenção / danificado | Sim, durante o período da manutenção (ou sem data de fim até ser resolvida) |
| Abate (perda definitiva) | Reduz o stock total através de um `InventoryMovement` |

\* Ver decisão D3: pré-reserva temporária de orçamentos enviados.

### 3.3 Cálculo

```
stockTotal(artigo, dia)    = stock base ± movimentos de inventário até esse dia
comprometido(artigo, dia)  = Σ quantidades de reservas/alugueres ativos que cobrem o dia
                           + Σ unidades em manutenção nesse dia
disponível(artigo, dia)    = stockTotal − comprometido

disponível(artigo, período) = MIN( disponível(artigo, dia) ) para cada dia do período
```

O exemplo do enunciado (100 cadeiras; 30 de 10/11 a 15/11; 40 de 12/11 a 18/11) dá 30 disponíveis a 13/11 e 60 a 16/11 — este exemplo entra como teste automático obrigatório.

Implementação: uma única query SQL por lote de artigos que gera a série de dias (`generate_series`) e soma as ocupações, ou um varrimento em memória ("sweep line") sobre os intervalos — rápido para milhares de linhas. Índices em `(articleId, startDate, endDate)` nas linhas de reserva.

### 3.4 Concorrência (dois vendedores, o mesmo stock)

Ao aprovar/reservar, numa **transação**:

1. `SELECT … FROM "Article" WHERE id IN (…) ORDER BY id FOR UPDATE` — bloqueia as linhas dos artigos envolvidos (sempre pela mesma ordem, para evitar deadlocks);
2. recalcula a disponibilidade dentro da transação;
3. se algum artigo não tiver quantidade suficiente em algum dia → aborta com mensagem clara ("Faltam 12 Cadeiras Chiavari a 14/11");
4. cria a reserva e as linhas, atualiza o estado do orçamento e regista auditoria.

Além disso, o orçamento tem um campo `version` (bloqueio otimista): duas aprovações em simultâneo do mesmo orçamento → a segunda falha com "Este orçamento foi alterado por outra pessoa".

Teste obrigatório: N aprovações em paralelo sobre o mesmo stock nunca ultrapassam o total.

---

## 4. Modelo de dados

Convenções: IDs `cuid`; valores monetários em **cêntimos (inteiros)** — nunca `float`; percentagens em pontos-base; `createdAt`/`updatedAt` em todas as tabelas; *soft delete* (`archivedAt`) em artigos, clientes e utilizadores, para não partir histórico.

### 4.1 Entidades e relações

```
User ─┬─< Session/Account (auth)
      ├── Role ─< RolePermission >── Permission
      ├─< UserPermissionOverride
      └── Client? (só utilizadores do portal)

Client ─< ClientContact
       ─< Event ─< Quote ─< QuoteItem ── Article
                         ─< QuoteService ── AdditionalService
                         ─< QuoteVersion (snapshot imutável + PDF)
                         ── Rental ─< RentalItem ── Article
                                   ─< RentalReturn (devoluções parciais)

Category ─< Article ─< ArticleImage
                    ─< InventoryMovement
                    ─< Maintenance
                    ── TaxRate

TaxRate ·  CompanySettings (1 linha) ·  DocumentSequence ·  AuditLog ·  EmailLog
```

### 4.2 Esboço do schema (campos principais)

```prisma
enum RoleKey        { ADMIN VENDEDOR CLIENTE }
enum ArticleStatus  { ATIVO INATIVO DESCONTINUADO }
enum QuoteStatus    { RASCUNHO AGUARDANDO_APROVACAO ENVIADO APROVADO REJEITADO EXPIRADO CANCELADO }
enum RentalStatus   { RESERVADO EM_PREPARACAO ENTREGUE EM_DEVOLUCAO DEVOLVIDO CANCELADO }
enum MaintenanceStatus { ABERTA EM_CURSO CONCLUIDA ABATIDA }
enum MovementType   { ENTRADA SAIDA_ABATE AJUSTE DANO REPARADO }
enum PriceUnit      { POR_EVENTO POR_DIA }        // ver decisão D1

model User {
  id String @id @default(cuid())
  name String
  email String @unique
  roleId String               // → Role
  clientId String?            // só para CLIENTE
  maxDiscountBp Int @default(0)
  active Boolean @default(true)
  lastLoginAt DateTime?
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  archivedAt DateTime?
}

model Role       { id, key RoleKey @unique, name, permissions RolePermission[] }
model Permission { id, key String @unique, description }   // "quote:approve"

model Client {
  id, type (EMPRESA|PARTICULAR), name, nif String?, email, phone,
  billingAddress, postalCode, city, country @default("PT"),
  notes, gdprConsentAt DateTime?, createdById, archivedAt
  @@index([name]) @@index([nif])
}
model ClientContact { id, clientId, name, role, email, phone }

model Category {
  id, name @unique, slug @unique, sortOrder, prepBufferDays Int @default(0), archivedAt
}

model Article {
  id, sku String @unique, name, description, categoryId,
  unit String @default("un"),
  priceCents Int, priceUnit PriceUnit,
  taxRateId,
  stockBase Int                       // stock inicial
  status ArticleStatus, internalNotes,
  version Int @default(0)             // alvo do SELECT … FOR UPDATE
  archivedAt
  @@index([categoryId]) @@index([name])   // + índice trigram para pesquisa rápida
}
// stockTotal, disponível, alugado e em manutenção são CALCULADOS, não guardados

model ArticleImage { id, articleId, storageKey, alt, sortOrder, isPrimary }

model InventoryMovement {
  id, articleId, type MovementType, quantity Int, effectiveDate DateTime @db.Date,
  reason, userId, rentalId?, maintenanceId?, createdAt
  @@index([articleId, effectiveDate])
}

model Maintenance {
  id, articleId, quantity Int, status MaintenanceStatus,
  startDate @db.Date, expectedEndDate @db.Date?, endDate @db.Date?,
  reason, rentalId?, cost Int?, userId
  @@index([articleId, startDate, endDate])
}

model Event {
  id, clientId, name, venue, address, city,
  setupAt DateTime, startDate @db.Date, endDate @db.Date, pickupAt DateTime, notes
}

model Quote {
  id, number String @unique,          // "ORC-2026-0001"
  clientId, eventId, createdById, assignedToId,
  status QuoteStatus,
  deliveryDate @db.Date, startDate @db.Date, endDate @db.Date, returnDate @db.Date,
  validUntil @db.Date,
  discountBp Int, notes, internalNotes, termsSnapshot,
  subtotalCents, discountCents, servicesCents, taxCents, totalCents,  // calculados no servidor
  currentVersion Int @default(0),
  version Int @default(0)             // bloqueio otimista
  sentAt, approvedAt, approvedByUserId?, approvedVia (INTERNO|PORTAL|EMAIL), rejectedReason
  @@index([status]) @@index([clientId]) @@index([createdById])
}

model QuoteItem {
  id, quoteId, articleId,
  quantity Int, unitPriceCents Int, priceUnit, days Int?,
  discountBp Int, taxRateBp Int, taxExemptionCode String?,   // snapshot da taxa
  descriptionSnapshot, skuSnapshot, sortOrder
}

model AdditionalService { id, name, defaultPriceCents, taxRateId, active }   // transporte, montagem…
model QuoteService      { id, quoteId, serviceId?, description, quantity, unitPriceCents, taxRateBp }

model QuoteVersion {
  id, quoteId, versionNumber Int, snapshot Json,     // cliente, evento, linhas, preços, condições
  pdfStorageKey, pdfSha256, issuedById, issuedAt, sentTo String?
  @@unique([quoteId, versionNumber])
}

model Rental {
  id, number @unique ("RES-2026-0001"), quoteId @unique, clientId, eventId,
  status RentalStatus, deliveryDate @db.Date, returnDate @db.Date,
  actualReturnDate @db.Date?, notes
  @@index([status, deliveryDate, returnDate])
}
model RentalItem {
  id, rentalId, articleId, quantity Int, quantityReturned Int @default(0),
  quantityDamaged Int @default(0),
  blockFrom @db.Date, blockTo @db.Date          // período que ocupa stock (inclui buffer)
  @@index([articleId, blockFrom, blockTo])
}
model RentalReturn { id, rentalId, returnedAt, receivedById, lines Json, notes }

model TaxRate {
  id, name ("Normal 23%"), rateBp Int (2300), region (CONTINENTE|ACORES|MADEIRA),
  exemptionCode String?, exemptionText String?, active, isDefault
}

model CompanySettings {      // linha única
  legalName, tradeName, nif, address, postalCode, city, phone, email, website, iban,
  logoKey, logoWhiteKey, quoteValidityDays, defaultTerms, quotePrefix,
  defaultTaxRateId, prepBufferDaysDefault, emailFrom
}

model DocumentSequence { key String @id ("ORC-2026"), last Int }  // numeração sem buracos, com lock
model AuditLog  { id, actorId?, action, entity, entityId, before Json?, after Json?, ip, userAgent, createdAt
                  @@index([entity, entityId]) @@index([createdAt]) }
model EmailLog  { id, quoteVersionId?, to, subject, status, providerId, error, createdAt }
```

### 4.3 Notas sobre IVA

- Taxas configuráveis em `TaxRate`; cada artigo e serviço tem a sua taxa por defeito; **cada linha do orçamento guarda a taxa aplicada (snapshot)**, para que mudanças futuras não alterem orçamentos emitidos.
- Seed: Continente 23% / 13% / 6%; Açores 16% / 9% / 4%; Madeira 22% / 12% / 5%; isenção com código de motivo (para clientes intracomunitários com autoliquidação, se aplicável). **As taxas e motivos devem ser confirmados pelo contabilista da Magnezya** — o sistema só garante que são configuráveis.
- O resumo do PDF apresenta a base tributável e o IVA **por taxa**.
- Arredondamento ao cêntimo por linha, com testes.

---

## 5. Estrutura de pastas

```
magnezya/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                     # dados fictícios realistas (catálogo Magnezya)
├─ prisma.config.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login, recuperar-palavra-passe
│  │  ├─ (admin)/                 # sidebar; ADMIN + VENDEDOR
│  │  │  ├─ painel/
│  │  │  ├─ artigos/  [id]/  novo/
│  │  │  ├─ categorias/
│  │  │  ├─ inventario/           # movimentos, manutenção
│  │  │  ├─ disponibilidade/
│  │  │  ├─ calendario/
│  │  │  ├─ reservas/  [id]/      # alugueres, entregas, devoluções
│  │  │  ├─ orcamentos/  novo/  [id]/  [id]/versoes/
│  │  │  ├─ clientes/  [id]/
│  │  │  ├─ utilizadores/
│  │  │  ├─ relatorios/
│  │  │  └─ definicoes/           # empresa, IVA, serviços, condições
│  │  ├─ (portal)/portal/         # CLIENTE
│  │  │  ├─ orcamentos/  [id]/
│  │  │  └─ conta/
│  │  └─ api/
│  │     ├─ auth/[...all]/
│  │     ├─ quotes/[id]/pdf/      # pré-visualização / download
│  │     └─ uploads/
│  ├─ components/
│  │  ├─ ui/                      # botões, inputs, tabela, dialog… (design próprio)
│  │  ├─ layout/                  # sidebar, topbar, theme toggle
│  │  └─ features/                # quote-builder, availability-grid, calendar…
│  ├─ server/
│  │  ├─ auth/                    # config, sessão, requirePermission
│  │  ├─ db.ts                    # cliente Prisma
│  │  ├─ services/
│  │  │  ├─ availability/
│  │  │  ├─ quotes/  rentals/  inventory/  clients/  users/
│  │  │  ├─ pricing/              # totais, descontos, IVA
│  │  │  ├─ pdf/  email/  storage/  audit/
│  │  └─ actions/                 # Server Actions finas, por módulo
│  ├─ lib/
│  │  ├─ validation/              # schemas Zod partilhados
│  │  ├─ format.ts                # €, números e datas pt-PT
│  │  └─ permissions.ts           # catálogo de permissões
│  ├─ emails/                     # templates React Email
│  ├─ pdf/                        # templates @react-pdf
│  └─ styles/                     # tokens de design, tema claro/escuro
├─ tests/
│  ├─ unit/  integration/  e2e/
├─ docs/                          # este plano, arquitetura, operação, RGPD
├─ docker-compose.yml             # Postgres + MinIO + Mailpit (desenvolvimento)
├─ .env.example
└─ README.md
```

---

## 6. Riscos técnicos e mitigação

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | Regras de disponibilidade mal definidas (buffers, atrasos, devoluções parciais) | Alto | Motor isolado e coberto por testes de cenários reais antes da UI; validar regras convosco na Fase 4 |
| R2 | Reservas em conflito com operações simultâneas | Alto | Locks por artigo + bloqueio otimista + teste de concorrência |
| R3 | Modelo de preço (por evento vs por dia vs degressivo) | Alto | Decisão D1 antes da Fase 3 |
| R4 | Fiscalidade: um orçamento não é documento fiscal; faturas em Portugal exigem software certificado pela AT | Médio | O sistema **não emite faturas**; integração futura opcional com Moloni / InvoiceXpress / Primavera via API |
| R5 | Migração das planilhas atuais | Médio | Importador CSV/Excel de artigos e clientes (com relatório de erros) — proposto na Fase 3 |
| R6 | Entregabilidade dos emails (spam) | Médio | Envio a partir do domínio magnezya.pt com SPF/DKIM/DMARC configurados |
| R7 | Calendário: vista por artigo/linha do tempo é paga no FullCalendar | Baixo | Usar vistas dia/semana/mês gratuitas + grelha de disponibilidade própria por artigo |
| R8 | Fotografias pesadas no PDF | Baixo | Redimensionar/comprimir no upload (sharp); miniaturas no PDF |
| R9 | RGPD | Médio | Alojamento na UE, minimização de dados, exportação e anonimização de cliente, registo de acessos, políticas de retenção, DPA com fornecedores |
| R10 | Backups | Alto | PITR do fornecedor + `pg_dump` diário encriptado para armazenamento separado + teste de reposição documentado |

---

## 7. Plano por fases

| Fase | Entregáveis | Critério de "feito" |
|---|---|---|
| **1** Estrutura, BD, autenticação | Projeto Next.js, design system (tokens, tema claro/escuro persistente), layout com sidebar, schema + migrations + seed, login, papéis e permissões, middleware, auditoria base | Login dos 3 perfis; cliente não acede a /admin; testes de permissões a passar |
| **2** Dashboard, utilizadores, clientes | CRUD de utilizadores e clientes (com contactos), dashboard com KPIs reais | Dados vêm da BD; confirmações em ações destrutivas |
| **3** Artigos e inventário | Artigos, categorias, fotos, movimentos, manutenção, pesquisa rápida, importador de planilhas | Stock alterado só via movimentos auditados |
| **4** Disponibilidade e calendário | Motor de disponibilidade, consulta por período, calendário dia/semana/mês, filtros, entregas e devoluções | Exemplo do enunciado + teste de concorrência a passar |
| **5** Orçamentos | Construtor de orçamento (poucos cliques), disponibilidade em tempo real por linha, descontos com limite, serviços, IVA por taxa, estados, aprovação → reserva | Aprovação recusa conflitos com mensagem clara |
| **6** PDF e email | Template PDF Magnezya, pré-visualização, versões imutáveis, envio por email com registo | Versões antigas reproduzem exatamente os valores originais |
| **7** Portal do cliente | Login de cliente, lista/detalhe/PDF, aprovar/rejeitar com registo (data, IP, utilizador), histórico, conta | Cliente nunca vê dados de outro cliente (testes E2E) |
| **8** Produção | Testes E2E completos, auditoria de segurança, performance, backups, monitorização (Sentry), documentação de operação e RGPD | Checklist de produção cumprida |

Cada fase termina com: fluxos principais testados, documentação atualizada, nenhum botão sem função e nenhum dado fictício em ecrãs já ligados à BD (o seed serve apenas para desenvolvimento e testes).

---

## 8. Decisões validadas (29/10/2026)

| # | Decisão |
|---|---|
| D1 | Preço **por dia** como regra inicial. O cálculo fica isolado num "motor de preço" (`services/pricing`) com estratégia por artigo (`priceUnit`), para poder passar a por evento ou degressivo sem mexer no resto. |
| D2 | **Better Auth**. |
| D3 | Orçamentos enviados **não bloqueiam stock**; aparecem como "procura pendente". |
| D4 | "Aguardando aprovação" = aprovação interna de administrador quando o desconto excede o limite do vendedor. |
| D5 | Vendedores **veem todos** os orçamentos e **editam só os seus**; o administrador (gerente) edita todos. |
| D6 | Aprovação do cliente sem stock: fica registada, a reserva fica em conflito e o vendedor é alertado. |
| D7 | Alojamento **por decidir**. Independentemente de onde está o programador, os dados têm de ficar **na UE** (RGPD; clientes em Portugal). O projeto é portátil (Docker), a decisão fica para a Fase 8. |
| D8 | Desenvolvimento na área de trabalho do Claude e sincronização para a pasta; o PC local está a instalar Git, Node.js e Docker. |
| D9 | Novas contas (e reposições) usam **palavra-passe temporária** definida pelo administrador; o utilizador é obrigado a alterá-la no primeiro login. Convite por email na Fase 6. *(30/10/2026)* |
| D10 | Só o **administrador** arquiva clientes (permissão `client:delete`, atribuível individualmente). *(30/10/2026)* |
| D11 | **NIF obrigatório** para empresas e particulares, único por cliente. Em Portugal valida o dígito de controlo; em clientes estrangeiros aceita o identificador fiscal do país. *(30/10/2026)* |

### 8.2 Decisões técnicas da Fase 3 (30/10/2026)

| # | Decisão |
|---|---|
| T1 | **Stock inicial imutável.** `stockBase` define-se ao criar o artigo; depois o stock só muda por movimentos (ENTRADA, ABATE, AJUSTE) auditados. |
| T2 | **SKU automático provisório:** prefixo da categoria + número sequencial (`CAD-0001`), sempre editável. *A confirmar com a Magnezya se já usam códigos próprios.* |
| T3 | **Manutenção:** ocupa stock desde o início até ao dia anterior à conclusão. Ao concluir, as unidades reparadas voltam e as perdidas saem por um ABATE ligado à manutenção. O motor de disponibilidade (Fase 4) segue a mesma convenção. |
| T4 | **Concorrência no stock:** movimentos e manutenções bloqueiam a linha do artigo (`SELECT … FOR UPDATE`) e validam o stock em todas as datas afetadas. |
| T5 | **Fotografias em disco local** (`STORAGE_DIR`) atrás de uma interface de armazenamento; o driver S3/R2 na UE entra quando o alojamento for decidido (D7). |

**Pendente da Fase 3:** importador de planilhas CSV/Excel com modelo próprio (ver §8.3).

### 8.3 Mudança de rumo (30/10/2026)

A Magnezya desistiu do sistema. O projeto continua como **produto próprio**, para vender a outras empresas de aluguer.

| # | Decisão |
|---|---|
| P1 | **Uma instalação por empresa cliente** (base de dados e marca próprias), não SaaS multiempresa. A arquitetura atual mantém-se. |
| P2 | **Mercado: Portugal** (euro, IVA, NIF, português de Portugal). |
| P3 | A **marca Magnezya** (nome, logótipo, imagens) pode ser usada no projeto, com autorização da empresa, como marca e catálogo de demonstração. |
| P4 | **Marca configurável** por instalação (`src/config/brand.ts`, variáveis `NEXT_PUBLIC_BRAND_*`). Nada específico de uma empresa fica fixo no código. |
| P5 | **Catálogo de demonstração real:** 264 peças de magnezya.pt em 12 categorias, com stock e preços fictícios e estáveis (`prisma/data/catalogo-magnezya.json`, gerado por `scripts/catalogo-magnezya.ts`). |
| P6 | **SKU:** prefixo da categoria + número (`CAD-0001` nos artigos novos; `CAD-8315` no catálogo importado, com o nº do produto na loja). Decisão resolvida, deixa de depender da Magnezya. |
| P7 | **Importador de planilhas** com um modelo próprio descarregável, em vez da planilha de um cliente concreto. |
| P8 | **Conjuntos/kits** (171 "sets" do catálogo: ex. sofá + 2 poltronas + mesa) como funcionalidade nova: um conjunto é composto por peças e ocupa o stock delas. Entra depois do motor de disponibilidade (Fase 4). Os conjuntos já estão guardados no ficheiro do catálogo. |

## 8.1 Questões originais (histórico)

**D1 — Modelo de preço.** O preço de aluguer é (a) por evento/período (ex.: até 3 dias), (b) por dia, ou (c) degressivo (1.º dia preço total, dias seguintes com desconto)? *Proposta:* suportar (a) e (b) por artigo, com (c) como regra opcional.

**D2 — Autenticação.** Better Auth (recomendado) ou Auth.js como pedido?

**D3 — Orçamentos enviados bloqueiam stock?** *Proposta:* não bloqueiam, mas aparecem como "procura pendente" com aviso; opcionalmente, pré-reserva com validade (ex.: 72 h) definida pelo vendedor.

**D4 — "Enviado" vs "Aguardando aprovação".** *Proposta:* "Aguardando aprovação" = aprovação interna de um administrador (desconto acima do limite do vendedor) antes de poder ser enviado. Alternativa: significar "cliente abriu a proposta".

**D5 — Visibilidade entre vendedores.** Cada vendedor vê só os seus orçamentos, ou todos (editando apenas os seus)?

**D6 — Aprovação pelo cliente quando o stock já não existe.** *Proposta:* a aprovação fica registada mas a reserva passa a "Aprovado – conflito de stock" e o vendedor é alertado para resolver.

**D7 — Alojamento.** (a) Vercel + Postgres gerido na UE (Neon/Supabase, Frankfurt) — mais simples; ou (b) servidor VPS na UE (Hetzner/OVH) com Docker — mais barato e controlável. Têm preferência ou domínio/servidor já contratado?

**D8 — Ambiente de desenvolvimento.** O projeto é desenvolvido e testado na minha área de trabalho e sincronizado para a pasta `MAGNEZYA PROJECT`. Para o correr no vosso PC precisam de Node.js 22 LTS e Docker Desktop (ou uma base de dados gerida). Confirmam?

**Informação a fornecer (pode ser mais tarde, até à Fase 6):** logótipo (vetorial, versões normal e branca), denominação legal, NIF, morada, contactos, IBAN, condições comerciais habituais, validade padrão das propostas, e um exemplo de uma planilha atual (para o importador e para confirmar campos).
