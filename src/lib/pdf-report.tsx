// Server-side PDF report built with @react-pdf/renderer (no headless browser).
// Rendered by /api/reports/[company]/pdf.
import React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { scoreBucket, tierLabel, SCORE_HEX, SCORE_LABEL } from "@/lib/scoring";

export type PdfReportData = {
  company: string;
  modeLabel: string;
  generatedAt: string; // formatted date string
  overall: { avg: number; count: number };
  breakdowns: {
    testName: string;
    avgOverall: number;
    topicAvgs: { name: string; avg: number }[];
  }[];
  solutions: {
    name: string;
    category?: string;
    testName: string;
    description?: string;
    actions: string[];
  }[];
  notes: string;
};

const INK = "#1c2420", INK2 = "#3d4742", INK3 = "#7a857f", LINE = "#e4e7e2", SUNKEN = "#f1f3ef";

const s = StyleSheet.create({
  page: { padding: 42, fontSize: 10, fontFamily: "Helvetica", color: INK2 },
  headerCard: { backgroundColor: SUNKEN, borderRadius: 10, padding: 22, marginBottom: 22 },
  eyebrow: { fontSize: 8, color: INK3, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 8 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 10, marginTop: 4 },
  badgeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  badge: { fontSize: 9, fontFamily: "Helvetica-Bold", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#fff" },
  scoreBig: { fontSize: 30, fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 18 },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 8, marginBottom: 10, overflow: "hidden" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, backgroundColor: SUNKEN },
  cardTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK },
  cardBody: { padding: 10, gap: 7 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 150, fontSize: 9 },
  barTrack: { flex: 1, height: 6, backgroundColor: SUNKEN, borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
  barVal: { width: 24, fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" },
  solTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  solName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK },
  solMeta: { fontSize: 8, color: INK3 },
  solDesc: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 4 },
  actionItem: { fontSize: 9, lineHeight: 1.45, marginLeft: 8 },
  notes: { fontSize: 10, lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, textAlign: "center", fontSize: 8, color: INK3, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
});

function ScoreBarPdf({ label, value }: { label: string; value: number }) {
  const color = SCORE_HEX[scoreBucket(value)];
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.barVal, { color }]}>{value}</Text>
    </View>
  );
}

export async function renderPdfReport(data: PdfReportData): Promise<Buffer> {
  return renderToBuffer((<PdfReport data={data} />) as React.ReactElement<DocumentProps>);
}

export function PdfReport({ data }: { data: PdfReportData }) {
  const bucket = scoreBucket(data.overall.avg);
  const color = SCORE_HEX[bucket];
  return (
    <Document title={`Reporte ${data.company}`} author="Auditoría">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerCard}>
          <Text style={s.eyebrow}>Reporte de evaluación · {data.modeLabel}</Text>
          <Text style={s.h1}>{data.company}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View style={s.badgeRow}>
              <Text style={[s.badge, { color }]}>{tierLabel(data.overall.avg)} · {SCORE_LABEL[bucket]}</Text>
              <Text style={[s.badge, { color: INK2 }]}>{data.overall.count} evaluacion{data.overall.count === 1 ? "" : "es"}</Text>
              <Text style={[s.badge, { color: INK3 }]}>{data.generatedAt}</Text>
            </View>
            <Text style={[s.scoreBig, { color }]}>{data.overall.avg}</Text>
          </View>
        </View>

        {/* Per-test breakdowns */}
        {data.breakdowns.length > 0 && (
          <View style={s.section}>
            <Text style={s.h2}>Resultados por cuestionario</Text>
            {data.breakdowns.map((td, i) => (
              <View key={i} style={s.card} wrap={false}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>{td.testName}</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: SCORE_HEX[scoreBucket(td.avgOverall)] }}>
                    {td.avgOverall} · {tierLabel(td.avgOverall)}
                  </Text>
                </View>
                <View style={s.cardBody}>
                  {td.topicAvgs.map((ta, j) => (
                    <ScoreBarPdf key={j} label={ta.name} value={ta.avg} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Solutions */}
        {data.solutions.length > 0 && (
          <View style={s.section}>
            <Text style={s.h2}>Soluciones recomendadas ({data.solutions.length})</Text>
            {data.solutions.map((sol, i) => (
              <View key={i} style={[s.card, { padding: 10 }]} wrap={false}>
                <View style={s.solTitleRow}>
                  <Text style={s.solName}>{sol.name}</Text>
                  {sol.category ? <Text style={s.solMeta}>[{sol.category}]</Text> : null}
                  <Text style={s.solMeta}>· {sol.testName}</Text>
                </View>
                {sol.description ? <Text style={s.solDesc}>{sol.description}</Text> : null}
                {sol.actions.map((a, j) => (
                  <Text key={j} style={s.actionItem}>•  {a}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {data.notes ? (
          <View style={s.section}>
            <Text style={s.h2}>Observaciones del consultor</Text>
            <View style={[s.card, { padding: 12 }]}>
              <Text style={s.notes}>{data.notes}</Text>
            </View>
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          Reporte generado por Auditoría · {data.company} · {data.generatedAt}
        </Text>
      </Page>
    </Document>
  );
}
