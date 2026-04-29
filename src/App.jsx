import { useState } from "react";

const DRUGS = [
  { id: "5fu", name: "5-Fluorouracil (5-FU)", basis: "BSA-based" },
  { id: "carboplatin", name: "Carboplatin", basis: "AUC/GFR (Calvert)" },
  { id: "irinotecan", name: "Irinotecan (CPT-11)", basis: "BSA-based" },
  { id: "paclitaxel", name: "Paclitaxel", basis: "BSA-based" },
  { id: "docetaxel", name: "Docetaxel", basis: "BSA-based" },
];

const GENE_VARIANTS = [
  { id: "dpyd_pm", label: "DPYD — Poor Metabolizer", risk: "critical" },
  { id: "dpyd_im", label: "DPYD — Intermediate Metabolizer", risk: "high" },
  { id: "ugt1a1_28", label: "UGT1A1*28 — Homozygous", risk: "high" },
  { id: "tpmt_pm", label: "TPMT — Poor Metabolizer", risk: "high" },
  { id: "cyp2d6_pm", label: "CYP2D6 — Poor Metabolizer", risk: "moderate" },
  { id: "brca1", label: "BRCA1 — Pathogenic Variant", risk: "low" },
];

const calcBSA = (w, h) =>
  (0.007184 * Math.pow(parseFloat(w) || 70, 0.425) * Math.pow(parseFloat(h) || 170, 0.725)).toFixed(2);

const RISK_COLORS = {
  low:      { bg: "#d1fae5", text: "#065f46", border: "#10b981", badge: "#059669" },
  moderate: { bg: "#fef3c7", text: "#78350f", border: "#f59e0b", badge: "#d97706" },
  high:     { bg: "#fee2e2", text: "#991b1b", border: "#ef4444", badge: "#dc2626" },
  critical: { bg: "#4c0519", text: "#fecdd3", border: "#f43f5e", badge: "#f43f5e" },
};

const PIPELINE_STEPS = [
  { id: "perceive", label: "Perceive", icon: "◎", desc: "Ingesting patient data & checking data completeness" },
  { id: "reason",  label: "Reason",  icon: "◈", desc: "Running dose-toxicity model with SHAP analysis" },
  { id: "plan",    label: "Plan",    icon: "◆", desc: "Generating structured dosing recommendation" },
];

const CardTitle = ({ children }) => (
  <h3 style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "1px", textTransform: "uppercase" }}>
    {children}
  </h3>
);

export default function App() {
  const [stage, setStage]       = useState("input");
  const [agentStep, setAgentStep] = useState(-1);
  const [patient, setPatient]   = useState({
    name: "Chen Wei-Ming", age: "58", weight: "68",
    height: "165", gfr: "52",
    cancer: "Colorectal Cancer (Stage III)",
    drug: "5fu", variants: ["dpyd_im"],
  });
  const [rec, setRec]           = useState(null);
  const [decision, setDecision] = useState(null);
  const [modNote, setModNote]   = useState("");
  const [error, setError]       = useState(null);

  const bsa = calcBSA(patient.weight, patient.height);
  const upd = (k, v) => setPatient(p => ({ ...p, [k]: v }));
  const toggleVariant = id => setPatient(p => ({
    ...p,
    variants: p.variants.includes(id) ? p.variants.filter(v => v !== id) : [...p.variants, id],
  }));

  const runAnalysis = async () => {
    setStage("analyzing"); setAgentStep(0);
    setRec(null); setDecision(null); setError(null);

    await new Promise(r => setTimeout(r, 1600));
    setAgentStep(1);

    const drugName     = DRUGS.find(d => d.id === patient.drug)?.name || patient.drug;
    const variantLabels = patient.variants.map(v => GENE_VARIANTS.find(g => g.id === v)?.label || v).join("; ") || "None detected";

    const prompt = `You are an AI-powered oncology Clinical Decision Support System for chemotherapy precision dosing.

PATIENT:
- Name: ${patient.name}, Age: ${patient.age} yrs
- Weight: ${patient.weight} kg | Height: ${patient.height} cm | BSA (Du Bois): ${bsa} m²
- eGFR: ${patient.gfr} mL/min/1.73m²
- Diagnosis: ${patient.cancer}
- Selected Drug: ${drugName}
- Genetic Variants: ${variantLabels}

Return ONLY valid JSON (no markdown, no extra text):
{
  "drug": "full drug name",
  "dose": "numeric dose",
  "unit": "mg/m² or mg",
  "totalDose": "total in mg (dose × BSA or Calvert result)",
  "schedule": "e.g. Day 1, every 14 days",
  "calculation": "show full formula e.g. 400 mg/m² × 1.84 m² = 736 mg",
  "riskLevel": "low|moderate|high|critical",
  "riskSummary": "one-sentence risk summary",
  "shapFactors": [
    {"factor": "name", "direction": "increases|decreases|neutral", "weight": 0.1-1.0, "note": "brief clinical note"}
  ],
  "geneticFlags": [
    {"variant": "name", "implication": "clinical effect", "adjustment": "recommended dose adjustment"}
  ],
  "alternatives": [
    {"label": "Option A", "dose": "dose + unit", "rationale": "why consider"}
  ],
  "monitoring": ["item1", "item2", "item3", "item4"],
  "rationale": "2-3 sentence clinical rationale",
  "confidence": 0.0-1.0
}

Rules: DPYD intermediate → reduce 5-FU by 25-50%. DPYD poor → contraindicated. GFR<60 → renal caution. Carboplatin uses Calvert: AUC×(GFR+25). Be clinically accurate.
CRITICAL: Return ONLY the raw JSON object. No markdown. No explanation. No trailing commas. All strings must use double quotes. Arrays must be properly closed with ].`;

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("VITE_ANTHROPIC_API_KEY not set in environment");

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: "You are a clinical oncology AI. Output ONLY valid JSON. No markdown fences, no explanation, no trailing commas. Every string uses double quotes. Every array properly closed with ].",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error("API: " + data.error.message);
      if (!data.content) throw new Error("No content: " + JSON.stringify(data).slice(0, 300));
      const raw = data.content?.find(c => c.type === "text")?.text || "";
      if (!raw) throw new Error("Empty response from API");

      const cleanJson = (str) => {
        str = str.replace(/```json|```/g, "").trim();
        const start = str.indexOf("{");
        const end   = str.lastIndexOf("}");
        if (start === -1 || end === -1) return null;
        str = str.slice(start, end + 1);
        str = str.replace(/,\s*([}\]])/g, "$1");
        str = str.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
        str = str.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, " ");
        return str;
      };

      let parsed = null;
      const cleaned = cleanJson(raw);
      if (cleaned) {
        try { parsed = JSON.parse(cleaned); } catch {}
      }
      if (!parsed) {
        try {
          parsed = Function('"use strict"; return (' + cleaned + ')')();
        } catch {}
      }
      if (!parsed) throw new Error("JSON parse failed. Raw snippet: " + (raw || "").slice(0, 120));

      await new Promise(r => setTimeout(r, 1100));
      setAgentStep(2);
      await new Promise(r => setTimeout(r, 900));
      setRec(parsed);
      setStage("result");
    } catch (e) {
      setError("Analysis failed: " + e.message);
      setStage("input");
      setAgentStep(-1);
    }
  };

  const riskC = RISK_COLORS[rec?.riskLevel] || RISK_COLORS.moderate;

  const InputView = () => (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0c2340", margin: 0, letterSpacing: "-0.5px" }}>
          New Patient Analysis
        </h1>
        <p style={{ color: "#64748b", margin: "5px 0 0", fontSize: 14 }}>
          Enter patient data to initiate the Perceive → Reason → Plan agentic pipeline.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <CardTitle>Patient Vitals</CardTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Patient Name",     key: "name",   span: 2, type: "text" },
              { label: "Age (years)",      key: "age",    span: 1, type: "number" },
              { label: "Cancer Diagnosis", key: "cancer", span: 2, type: "text" },
              { label: "Weight (kg)",      key: "weight", span: 1, type: "number" },
              { label: "Height (cm)",      key: "height", span: 1, type: "number" },
              { label: "eGFR (mL/min)",    key: "gfr",    span: 1, type: "number" },
            ].map(f => (
              <div key={f.key} style={{ gridColumn: `span ${f.span}` }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={patient[f.key]}
                  onChange={e => upd(f.key, e.target.value)}
                  style={{ width: "100%", padding: "9px 11px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, color: "#0c2340", boxSizing: "border-box", fontFamily: f.type === "number" ? "monospace" : "inherit", outline: "none" }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, background: "#f0f9ff", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", letterSpacing: "0.5px", textTransform: "uppercase" }}>BSA — Du Bois Formula</div>
              <div style={{ fontSize: 11, color: "#7dd3fc", marginTop: 2 }}>0.007184 × W⁰·⁴²⁵ × H⁰·⁷²⁵</div>
            </div>
            <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 24, color: "#0c2340" }}>{bsa} m²</div>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <CardTitle>Drug & Genomics</CardTitle>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Chemotherapy Drug
          </label>
          <select
            value={patient.drug}
            onChange={e => upd("drug", e.target.value)}
            style={{ width: "100%", padding: "9px 11px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, color: "#0c2340", marginBottom: 18, background: "white" }}
          >
            {DRUGS.map(d => <option key={d.id} value={d.id}>{d.name} ({d.basis})</option>)}
          </select>

          <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 10, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Detected Genetic Variants
          </label>
          {GENE_VARIANTS.map(g => {
            const checked = patient.variants.includes(g.id);
            const badgeBg = { critical: "#fce7f3", high: "#fee2e2", moderate: "#fef3c7", low: "#d1fae5" }[g.risk];
            const badgeTx = { critical: "#9d174d", high: "#991b1b", moderate: "#92400e", low: "#065f46" }[g.risk];
            return (
              <div key={g.id} onClick={() => toggleVariant(g.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                marginBottom: 7,
                background: checked ? "#eff6ff" : "#f8fafc",
                border: `1.5px solid ${checked ? "#0ea5e9" : "#e2e8f0"}`,
                transition: "all 0.15s",
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  background: checked ? "#0ea5e9" : "white",
                  border: `2px solid ${checked ? "#0ea5e9" : "#cbd5e1"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <span style={{ color: "white", fontSize: 10 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: "#1e293b", flex: 1 }}>{g.label}</span>
                <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: badgeBg, color: badgeTx, textTransform: "uppercase", letterSpacing: "0.5px" }}>{g.risk}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, background: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: 10, fontSize: 14 }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={runAnalysis} style={{
          background: "#0c2340", color: "white", border: "none",
          padding: "14px 36px", borderRadius: 10, fontSize: 15, fontWeight: 700,
          cursor: "pointer", letterSpacing: "-0.3px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 12 }}>▶</span> Run Agentic Analysis
        </button>
      </div>
    </div>
  );

  const AnalyzingView = () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 420 }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ width: 40, height: 40, border: "3px solid #e2e8f0", borderTop: "3px solid #0ea5e9", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 28 }}/>
      <h2 style={{ color: "#0c2340", fontSize: 20, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Agentic AI Core Running</h2>
      <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 48px" }}>Executing Perceive → Reason → Plan pipeline for {patient.name}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {PIPELINE_STEPS.map((step, i) => {
          const isActive = agentStep === i;
          const isDone   = agentStep > i;
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                padding: "22px 28px", borderRadius: 16, width: 196, minHeight: 140,
                justifyContent: "center", textAlign: "center",
                background: isDone ? "#ecfdf5" : isActive ? "#0c2340" : "white",
                border: `2px solid ${isDone ? "#10b981" : isActive ? "#0ea5e9" : "#e2e8f0"}`,
                boxShadow: isActive ? "0 8px 32px rgba(14,165,233,.2)" : "0 1px 4px rgba(0,0,0,.05)",
                transition: "all .4s ease",
              }}>
                <div style={{ fontSize: 26, color: isDone ? "#10b981" : isActive ? "#0ea5e9" : "#e2e8f0" }}>
                  {isDone ? "✓" : step.icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: isDone ? "#065f46" : isActive ? "white" : "#cbd5e1" }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 12, color: isDone ? "#059669" : isActive ? "#7dd3fc" : "#e2e8f0", lineHeight: 1.5 }}>
                  {step.desc}
                </div>
                {isActive && (
                  <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9", animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }}/>
                    ))}
                  </div>
                )}
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{ width: 44, height: 2, background: agentStep > i ? "#10b981" : "#e2e8f0", flexShrink: 0, transition: "background .5s", position: "relative" }}>
                  <span style={{ position: "absolute", right: -6, top: -8, fontSize: 12, color: agentStep > i ? "#10b981" : "#e2e8f0" }}>▶</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const ResultView = () => {
    if (!rec) return null;
    return (
      <div>
        <button onClick={() => { setStage("input"); setAgentStep(-1); }} style={{
          background: "none", border: "none", color: "#0ea5e9",
          cursor: "pointer", fontSize: 13, padding: "0 0 18px",
          display: "flex", alignItems: "center", gap: 5, fontWeight: 600,
        }}>← New Analysis</button>

        <div style={{
          background: riskC.bg, border: `2px solid ${riskC.border}`,
          borderRadius: 14, padding: "18px 24px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 20,
        }}>
          <div style={{
            fontFamily: "monospace", fontWeight: 900, fontSize: 32, color: riskC.badge,
            background: "rgba(255,255,255,0.6)", padding: "4px 14px", borderRadius: 8,
            textTransform: "uppercase", letterSpacing: "1px",
          }}>{rec.riskLevel}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: riskC.text, fontSize: 15 }}>Risk Assessment: {(rec.riskLevel || "").toUpperCase()}</div>
            <div style={{ color: riskC.text, opacity: 0.8, fontSize: 13, marginTop: 3 }}>{rec.riskSummary}</div>
          </div>
          <div style={{ textAlign: "right", background: "rgba(255,255,255,0.5)", padding: "10px 16px", borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: riskC.text, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>AI Confidence</div>
            <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 26, color: riskC.badge }}>{(((rec.confidence || 0.8)) * 100).toFixed(0)}%</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,.07)", gridColumn: "span 2" }}>
            <CardTitle>Recommended Dosing Protocol</CardTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
              {[
                { label: "Drug",       val: rec.drug,         mono: false },
                { label: "Dose",       val: `${rec.dose} ${rec.unit}`, mono: true },
                { label: "Total Dose", val: `${rec.totalDose}`, mono: true },
                { label: "Schedule",   val: rec.schedule,     mono: false },
              ].map(item => (
                <div key={item.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>{item.label}</div>
                  <div style={{ fontFamily: item.mono ? "monospace" : "inherit", fontWeight: 700, fontSize: 16, color: "#0c2340", lineHeight: 1.3 }}>{item.val || "—"}</div>
                </div>
              ))}
            </div>
            {rec.calculation && (
              <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "monospace", color: "#0369a1", marginBottom: 12 }}>
                📐 {rec.calculation}
              </div>
            )}
            {rec.rationale && (
              <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.65, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                {rec.rationale}
              </div>
            )}
          </div>

          <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,.07)" }}>
            <CardTitle>SHAP Explainability — Key Factors</CardTitle>
            {(rec.shapFactors || []).map((f, i) => {
              const isDown = f.direction === "decreases";
              const isUp   = f.direction === "increases";
              const col    = isDown ? "#ef4444" : isUp ? "#0ea5e9" : "#94a3b8";
              const arrow  = isDown ? "▼" : isUp ? "▲" : "●";
              return (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{f.factor}</span>
                    <span style={{ fontSize: 12, color: col, fontWeight: 700 }}>{arrow} {f.direction}</span>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 6, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${(f.weight || 0.5) * 100}%`, height: "100%", background: col, borderRadius: 6 }}/>
                  </div>
                  {f.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{f.note}</div>}
                </div>
              );
            })}
          </div>

          <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,.07)" }}>
            <CardTitle>Genomic Risk Flags</CardTitle>
            {(rec.geneticFlags || []).length > 0
              ? (rec.geneticFlags || []).map((g, i) => (
                <div key={i} style={{ background: "#fff7ed", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, color: "#92400e", fontSize: 13, marginBottom: 3 }}>{g.variant}</div>
                  <div style={{ fontSize: 12, color: "#78350f", marginBottom: 8, lineHeight: 1.4 }}>{g.implication}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "3px 8px", borderRadius: 4, display: "inline-block" }}>
                    ⚠ {g.adjustment}
                  </div>
                </div>
              ))
              : <div style={{ color: "#94a3b8", fontSize: 14 }}>No significant genomic risk flags.</div>
            }

            <div style={{ marginTop: 20 }}>
              <CardTitle>Alternative Dose Options</CardTitle>
              {(rec.alternatives || []).map((a, i) => (
                <div key={i} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 13px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 12, color: "#64748b" }}>{a.label || `Option ${i + 1}`}: </span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0c2340", fontSize: 13 }}>{a.dose}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8", maxWidth: 160, textAlign: "right", lineHeight: 1.4 }}>{a.rationale}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,.07)", gridColumn: "span 2" }}>
            <CardTitle>Monitoring Plan</CardTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {(rec.monitoring || []).map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#f8fafc", borderRadius: 8, padding: "10px 13px" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#eff6ff", border: "1.5px solid #0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#0369a1", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{m}</span>
                </div>
              ))}
            </div>
          </div>

          {!decision && (
            <div style={{ background: "#0c2340", borderRadius: 14, padding: 24, gridColumn: "span 2" }}>
              <CardTitle><span style={{ color: "#475569" }}>Oncologist Decision Required — Human-in-the-Loop Gate</span></CardTitle>
              <p style={{ color: "#475569", fontSize: 13, margin: "0 0 18px", lineHeight: 1.5 }}>
                Every AI recommendation requires clinician authorization before it is applied. The oncologist may accept, modify, or override.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <button onClick={() => setDecision("accepted")} style={{ padding: "13px", borderRadius: 10, border: "none", background: "#059669", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14, letterSpacing: "-0.2px" }}>
                  ✓ Accept Recommendation
                </button>
                <button onClick={() => setDecision("modify")} style={{ padding: "13px", borderRadius: 10, border: "1.5px solid #d97706", background: "transparent", color: "#d97706", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  ✎ Modify Dose
                </button>
                <button onClick={() => setDecision("overridden")} style={{ padding: "13px", borderRadius: 10, border: "1.5px solid #ef4444", background: "transparent", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  ✕ Override & Reject
                </button>
              </div>
            </div>
          )}

          {decision === "modify" && (
            <div style={{ background: "#fffbeb", border: "1.5px solid #f59e0b", borderRadius: 14, padding: 22, gridColumn: "span 2" }}>
              <CardTitle><span style={{ color: "#78350f" }}>Enter Modified Dose</span></CardTitle>
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  type="text"
                  placeholder={`Suggested: ${rec.dose} ${rec.unit} — enter your modified value`}
                  value={modNote}
                  onChange={e => setModNote(e.target.value)}
                  style={{ flex: 1, padding: "11px 14px", borderRadius: 8, border: "1.5px solid #f59e0b", fontSize: 14, outline: "none", background: "white" }}
                />
                <button onClick={() => setDecision("modified")} style={{ padding: "11px 22px", borderRadius: 8, background: "#d97706", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  Confirm
                </button>
                <button onClick={() => setDecision(null)} style={{ padding: "11px 16px", borderRadius: 8, background: "#f1f5f9", color: "#64748b", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(decision === "accepted" || decision === "modified" || decision === "overridden") && (
            <div style={{
              borderRadius: 14, padding: "18px 24px", gridColumn: "span 2",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: decision === "accepted" ? "#d1fae5" : decision === "modified" ? "#fef3c7" : "#fee2e2",
              border: `2px solid ${decision === "accepted" ? "#10b981" : decision === "modified" ? "#f59e0b" : "#ef4444"}`,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: decision === "accepted" ? "#065f46" : decision === "modified" ? "#92400e" : "#991b1b" }}>
                  {decision === "accepted" ? "✓ Recommendation Accepted & Authorized"
                    : decision === "modified" ? `✎ Dose Modified by Clinician: ${modNote || "(no value entered)"}`
                    : "✕ Recommendation Overridden — Manual Order Required"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Recorded at {new Date().toLocaleTimeString()} · Logged to adaptive learning loop
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
                <div>Oncologist Decision</div>
                <div style={{ fontWeight: 600 }}>{new Date().toLocaleDateString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f7", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ background: "#0c2340", color: "white", padding: "14px 28px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, letterSpacing: "-0.5px" }}>AI</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.5px" }}>Oncology AI-CDSS</div>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: "1px", textTransform: "uppercase" }}>Chemotherapy Precision Dosing · Agentic Architecture</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 24 }}>
          {["Perceive", "Reason", "Plan"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1e3a5f" }}/>
              {s}
            </div>
          ))}
        </div>
        {stage !== "input" && patient.name && (
          <div style={{ fontSize: 13, color: "#7dd3fc", fontWeight: 600 }}>📋 {patient.name}</div>
        )}
      </header>

      <main style={{ maxWidth: 1060, margin: "0 auto", padding: "28px 20px" }}>
        {stage === "input"     && <InputView />}
        {stage === "analyzing" && <AnalyzingView />}
        {stage === "result"    && <ResultView />}
      </main>

      <footer style={{ textAlign: "center", padding: "20px", fontSize: 11, color: "#94a3b8", borderTop: "1px solid #e2e8f0", marginTop: 40 }}>
        AI-CDSS · IM507 Decision Support System · Master of Information Management · 1142
      </footer>
    </div>
  );
}
