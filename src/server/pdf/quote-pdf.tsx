/* eslint-disable jsx-a11y/alt-text -- <Image> do react-pdf não é HTML e não aceita "alt". */
import "server-only";
import type { Styles } from "@react-pdf/renderer";
import { getObject } from "@/server/services/storage";
import { toPdfJpeg } from "@/server/services/images";
import { formatBasisPoints, formatCents, formatDateTime, formatInteger, formatISODate } from "@/lib/format";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";

/**
 * Proposta em PDF (A4), gerada a partir de um snapshot imutável.
 * Fonte Helvetica (incluída no PDF, suporta acentos e €); as fotografias
 * são convertidas para JPEG pequeno para o ficheiro ficar leve.
 *
 * A biblioteca de PDF é carregada só quando é preciso gerar um documento
 * (import dinâmico): não pesa no arranque e funciona também nos testes.
 */
type ReactPdf = typeof import("@react-pdf/renderer");

const INK = "#111111";
const MUTED = "#6b6b6b";
const LINE = "#e2e2e2";

const s = {
  page: { paddingTop: 40, paddingBottom: 70, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  logo: { maxWidth: 170, maxHeight: 56, objectFit: "contain" },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 18, letterSpacing: 3 },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: 16, textAlign: "right" },
  docMeta: { textAlign: "right", color: MUTED, marginTop: 3 },
  boxes: { flexDirection: "row", gap: 16, marginBottom: 20 },
  box: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 10 },
  boxTitle: { fontFamily: "Helvetica-Bold", fontSize: 7, color: MUTED, letterSpacing: 1, marginBottom: 5 },
  strong: { fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 6, marginTop: 4 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: INK, paddingBottom: 4, fontFamily: "Helvetica-Bold", fontSize: 7, color: MUTED },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: LINE, paddingVertical: 5, alignItems: "center" },
  photo: { width: 34, height: 34, objectFit: "contain", marginRight: 8 },
  photoEmpty: { width: 34, height: 34, marginRight: 8, backgroundColor: "#f3f3f3" },
  colName: { flex: 1, paddingRight: 6 },
  colNum: { width: 46, textAlign: "right" },
  colWide: { width: 66, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: INK, marginTop: 4, paddingTop: 6, fontFamily: "Helvetica-Bold", fontSize: 12 },
  block: { marginTop: 18 },
  term: { flexDirection: "row", marginBottom: 2.5 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, borderTopWidth: 0.5, borderColor: LINE, paddingTop: 6, fontSize: 7, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
  watermark: { position: "absolute", top: 330, left: 70, fontSize: 92, color: "#ececec", fontFamily: "Helvetica-Bold", transform: "rotate(-30deg)" },
} satisfies Styles;

/** Helvetica não tem o espaço fino que o pt-PT usa nos milhares: troca por espaço normal. */
const plain = (text: string) => text.replace(/[  ]/g, " ");
const money = (cents: number) => plain(formatCents(cents));
const pct = (bp: number) => plain(formatBasisPoints(bp));
const date = (iso: string) => formatISODate(iso);

async function loadJpeg(key: string | null, size: number) {
  if (!key) return null;
  const data = await getObject(key.replace(/\.webp$/, "-thumb.webp"));
  return data ? { data: await toPdfJpeg(data, size), format: "jpg" as const } : null;
}

async function loadLogo(key: string | null) {
  if (!key) return null;
  const data = await getObject(key);
  return data ? { data, format: "png" as const } : null;
}

function QuoteDocument({
  pdf: { Document, Image, Page, Text, View },
  q,
  draft,
  logo,
  photos,
}: {
  pdf: ReactPdf;
  q: QuoteSnapshot;
  draft: boolean;
  logo: { data: Buffer; format: "png" } | null;
  photos: ({ data: Buffer; format: "jpg" } | null)[];
}) {
  const c = q.company;
  const clientAddress = [q.client.address, [q.client.postalCode, q.client.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const companyLine = [c.legalName, c.nif && `NIF ${c.nif}`, [c.address, c.postalCode, c.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const iban = c.iban?.replace(/(.{4})/g, "$1 ").trim();
  const contactLine = [c.phone, c.email, c.website, iban && `IBAN ${iban}`].filter(Boolean).join(" · ");
  const terms = (q.terms ?? "").split("\n").map((t) => t.trim()).filter(Boolean);

  const itemRow = (i: number) => {
    const item = q.items[i];
    if (!item) return null;
    const photo = photos[i];
    return (
      <View key={`${item.sku}-${i}`} style={s.tr} wrap={false}>
        {photo ? <Image style={s.photo} src={photo} /> : <View style={s.photoEmpty} />}
        <View style={s.colName}>
          <Text>{item.name}</Text>
          <Text style={s.muted}>{item.sku}</Text>
        </View>
        <Text style={s.colNum}>
          {formatInteger(item.quantity)} {item.unit}
        </Text>
        <Text style={s.colWide}>
          {money(item.unitPriceCents)}
          {item.priceUnit === "POR_DIA" ? "/dia" : ""}
        </Text>
        <Text style={s.colNum}>{item.priceUnit === "POR_DIA" ? item.billableDays : "—"}</Text>
        <Text style={s.colNum}>{item.discountBp ? pct(item.discountBp) : "—"}</Text>
        <Text style={s.colNum}>{pct(item.taxRateBp)}</Text>
        <Text style={s.colWide}>{money(item.totalCents)}</Text>
      </View>
    );
  };

  const serviceRow = (i: number) => {
    const svc = q.services[i];
    if (!svc) return null;
    return (
      <View key={i} style={s.tr} wrap={false}>
        <Text style={s.colName}>{svc.description}</Text>
        <Text style={s.colNum}>{formatInteger(svc.quantity)}</Text>
        <Text style={s.colWide}>{money(svc.unitPriceCents)}</Text>
        <Text style={s.colNum}>{pct(svc.taxRateBp)}</Text>
        <Text style={s.colWide}>{money(svc.totalCents)}</Text>
      </View>
    );
  };

  const termRow = (i: number) => (
    <View key={i} style={s.term} wrap={false}>
      <Text style={{ width: 10 }}>•</Text>
      <Text style={{ flex: 1 }}>{terms[i]}</Text>
    </View>
  );

  return (
    <Document title={`Proposta ${q.number}`} author={c.tradeName} creator={c.tradeName} language="pt-PT">
      <Page size="A4" style={s.page}>
        {draft && (
          <Text style={s.watermark} fixed>
            RASCUNHO
          </Text>
        )}

        <View style={s.header}>
          {logo ? <Image style={s.logo} src={logo} /> : <Text style={s.wordmark}>{c.tradeName.toUpperCase()}</Text>}
          <View>
            <Text style={s.docTitle}>Proposta {q.number}</Text>
            <Text style={s.docMeta}>
              {draft ? "Rascunho — sem valor de proposta" : `Versão ${q.version} · emitida a ${plain(formatDateTime(q.issuedAt))}`}
            </Text>
            <Text style={s.docMeta}>Válida até {date(q.validUntil)}</Text>
          </View>
        </View>

        <View style={s.boxes}>
          <View style={s.box}>
            <Text style={s.boxTitle}>CLIENTE</Text>
            <Text style={s.strong}>{q.client.name}</Text>
            <Text>NIF {q.client.nif}</Text>
            {clientAddress ? <Text>{clientAddress}</Text> : null}
            {q.contact ? (
              <Text style={s.muted}>
                {[q.contact.name, q.contact.email, q.contact.phone].filter(Boolean).join(" · ")}
              </Text>
            ) : (
              <Text style={s.muted}>{[q.client.email, q.client.phone].filter(Boolean).join(" · ")}</Text>
            )}
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>EVENTO</Text>
            <Text style={s.strong}>{q.event.name}</Text>
            {q.event.venue || q.event.city ? <Text>{[q.event.venue, q.event.city].filter(Boolean).join(", ")}</Text> : null}
            <Text>
              Evento: {date(q.dates.start)}
              {q.dates.end !== q.dates.start ? ` a ${date(q.dates.end)}` : ""} ({q.billableDays} {q.billableDays === 1 ? "dia" : "dias"})
            </Text>
            <Text style={s.muted}>
              Entrega/montagem {date(q.dates.delivery)} · Recolha {date(q.dates.return)}
            </Text>
          </View>
        </View>

        {/* Título, cabeçalho e 1.ª linha num bloco indivisível: nunca ficam sozinhos no fim da página. */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>Artigos</Text>
          <View style={s.th}>
            <Text style={{ width: 42 }} />
            <Text style={s.colName}>ARTIGO</Text>
            <Text style={s.colNum}>QTD.</Text>
            <Text style={s.colWide}>PREÇO UN.</Text>
            <Text style={s.colNum}>DIAS</Text>
            <Text style={s.colNum}>DESC.</Text>
            <Text style={s.colNum}>IVA</Text>
            <Text style={s.colWide}>TOTAL</Text>
          </View>
          {itemRow(0)}
        </View>
        {q.items.slice(1).map((_, i) => itemRow(i + 1))}

        {q.services.length > 0 && (
          <View style={s.block}>
            <View wrap={false}>
              <Text style={s.sectionTitle}>Serviços</Text>
              <View style={s.th}>
                <Text style={s.colName}>SERVIÇO</Text>
                <Text style={s.colNum}>QTD.</Text>
                <Text style={s.colWide}>PREÇO UN.</Text>
                <Text style={s.colNum}>IVA</Text>
                <Text style={s.colWide}>TOTAL</Text>
              </View>
              {serviceRow(0)}
            </View>
            {q.services.slice(1).map((_, i) => serviceRow(i + 1))}
          </View>
        )}

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text>Artigos</Text>
            <Text>{money(q.totals.subtotalCents)}</Text>
          </View>
          {q.totals.discountCents > 0 && (
            <View style={s.totalRow}>
              <Text>Desconto ({pct(q.globalDiscountBp)})</Text>
              <Text>-{money(q.totals.discountCents)}</Text>
            </View>
          )}
          {q.totals.servicesCents > 0 && (
            <View style={s.totalRow}>
              <Text>Serviços</Text>
              <Text>{money(q.totals.servicesCents)}</Text>
            </View>
          )}
          {q.totals.taxLines.map((t) => (
            <View key={t.rateBp} style={s.totalRow}>
              <Text style={s.muted}>
                IVA {pct(t.rateBp)} sobre {money(t.baseCents)}
              </Text>
              <Text>{money(t.taxCents)}</Text>
            </View>
          ))}
          <View style={s.grandTotal}>
            <Text>Total</Text>
            <Text>{money(q.totals.totalCents)}</Text>
          </View>
        </View>

        {q.notes ? (
          <View style={s.block} wrap={false}>
            <Text style={s.sectionTitle}>Observações</Text>
            <Text>{q.notes}</Text>
          </View>
        ) : null}

        {terms.length > 0 && (
          <View style={s.block}>
            <View wrap={false}>
              <Text style={s.sectionTitle}>Condições</Text>
              {termRow(0)}
            </View>
            {terms.slice(1).map((_, i) => termRow(i + 1))}
          </View>
        )}

        <Text style={[s.muted, { marginTop: 18, fontSize: 7 }]}>
          Esta proposta não é uma fatura. Valores em euros.
        </Text>

        <View style={s.footer} fixed>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text>{companyLine}</Text>
            {contactLine ? <Text>{contactLine}</Text> : null}
          </View>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(snapshot: QuoteSnapshot, { draft = false } = {}): Promise<Buffer> {
  const [pdf, logo, photos] = await Promise.all([
    import("@react-pdf/renderer"),
    loadLogo(snapshot.company.logoKey),
    Promise.all(snapshot.items.map((item) => loadJpeg(item.imageKey, 120).catch(() => null))),
  ]);
  return pdf.renderToBuffer(<QuoteDocument pdf={pdf} q={snapshot} draft={draft} logo={logo} photos={photos} />);
}
