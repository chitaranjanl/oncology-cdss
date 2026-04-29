# 🏥 Oncology AI-CDSS

**AI-powered Clinical Decision Support System for chemotherapy precision dosing with an agentic architecture.**

This system integrates pharmacogenomic profiling, dose-toxicity modeling, and SHAP explainability with human-in-the-loop authorization gates to support evidence-based chemotherapy dosing recommendations.

---

## ✨ Key Features

- 🧬 **Pharmacogenomic Integration** — DPYD, UGT1A1, TPMT, CYP2D6, BRCA1 variant detection
- 🤖 **Agentic Pipeline** — Perceive → Reason → Plan with real-time progress visualization
- 📊 **SHAP Explainability** — Feature importance visualization for model transparency
- ⚠️ **Risk Stratification** — Critical/High/Moderate/Low with confidence scoring
- 👥 **Human-in-the-Loop** — Clinician accept/modify/override authorization gates
- 📋 **Structured Monitoring** — 4-item clinical surveillance checklists
- 💊 **Multi-Drug Support** — 5-FU, Carboplatin, Irinotecan, Paclitaxel, Docetaxel
- 🧮 **Automatic Calculations** — Du Bois BSA formula, Calvert renal adjustment

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
git clone https://github.com/chitaranjanl/oncology-cdss.git
cd oncology-cdss
npm install
```

### Configuration

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Anthropic API key:

```
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 🔧 Build for Production

```bash
npm run build    # Creates optimized dist/ folder
npm run preview  # Preview production build locally
```

---

## 📋 Supported Drugs & Dosing Bases

| Drug | Dosing Basis | Adjustment | Interaction |
|------|------------|-----------|-------------|
| **5-Fluorouracil (5-FU)** | BSA-based | DPYD metabolizer status | Poor/Intermediate → 25-50% reduction |
| **Carboplatin** | AUC/GFR (Calvert) | Renal function | eGFR <60 → caution |
| **Irinotecan (CPT-11)** | BSA-based | UGT1A1*28 genotype | Homozygous → increased toxicity |
| **Paclitaxel** | BSA-based | Age, renal function | eGFR <60 → dose adjust |
| **Docetaxel** | BSA-based | Age, renal function | eGFR <60 → dose adjust |

---

## 🧬 Pharmacogenomic Variants

### DPYD (Dihydropyrimidine Dehydrogenase)
- **Poor Metabolizer (PM)** — 🔴 **CRITICAL** — 5-FU contraindicated
- **Intermediate Metabolizer (IM)** — 🟠 **HIGH** — Reduce 5-FU by 25-50%

### UGT1A1
- **UGT1A1*28 (Homozygous)** — 🟠 **HIGH** — Irinotecan toxicity risk

### TPMT (Thiopurine Methyltransferase)
- **Poor Metabolizer (PM)** — 🟠 **HIGH** — Thiopurine metabolism impaired

### CYP2D6 (Cytochrome P450 2D6)
- **Poor Metabolizer (PM)** — 🟡 **MODERATE** — Multiple drug interactions

### BRCA1
- **Pathogenic Variant** — 🟢 **LOW** — Impacts treatment selection

---

## 🏗️ System Architecture

### **Perceive Stage**
- Validates patient data completeness
- Calculates BSA using Du Bois formula: `0.007184 × W⁰·⁴²⁵ × H⁰·⁷²⁵`
- Extracts clinical parameters (age, weight, height, eGFR, cancer diagnosis)
- Identifies genetic variants

### **Reason Stage**
- Calls Claude API with dose-toxicity prompt
- Integrates pharmacogenomic risk factors
- Generates SHAP explainability factors
- Computes risk assessment (low/moderate/high/critical)
- Calculates AI confidence scores

### **Plan Stage**
- Structures dosing recommendations
- Produces alternative dose options
- Generates monitoring checklists
- Provides clinical rationale
- Logs decision to adaptive learning loop

---

## 📊 Output Structure

The system generates a comprehensive recommendation object:

```json
{
  "drug": "5-Fluorouracil (5-FU)",
  "dose": "300",
  "unit": "mg/m²",
  "totalDose": "552 mg",
  "schedule": "Day 1, every 14 days",
  "calculation": "300 mg/m² × 1.84 m² = 552 mg (reduced 25% for DPYD-IM)",
  "riskLevel": "high",
  "riskSummary": "DPYD intermediate metabolizer detected. Significant toxicity risk with 5-FU at standard dosing.",
  "shapFactors": [
    {
      "factor": "DPYD Status",
      "direction": "decreases",
      "weight": 0.85,
      "note": "Impaired fluoropyrimidine metabolism"
    }
  ],
  "geneticFlags": [
    {
      "variant": "DPYD — Intermediate Metabolizer",
      "implication": "Impaired fluoropyrimidine metabolism. May accumulate toxic metabolites.",
      "adjustment": "Reduce by 25%"
    }
  ],
  "alternatives": [
    {
      "label": "Conservative",
      "dose": "250 mg/m²",
      "rationale": "40% reduction for high-risk patients"
    }
  ],
  "monitoring": [
    "CBC + differential (weekly for 4 weeks)",
    "Comprehensive metabolic panel (baseline + weekly)",
    "DPD phenotyping",
    "Clinical assessment for GI toxicity & neutropenia (pre-cycle & day 4)"
  ],
  "rationale": "DPYD intermediate metabolizer status warrants 25-50% dose reduction...",
  "confidence": 0.87
}
```

---

## 🛡️ Human-in-the-Loop Authorization

Every AI recommendation requires clinician authorization before implementation:

- ✅ **Accept** — Recommendation approved as-is
- ✎ **Modify** — Clinician adjusts dose; records modification
- ✕ **Override** — Recommendation rejected; manual order required

All decisions are logged with timestamp and clinician ID for audit trail.

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Then set environment variable in Vercel Dashboard:
```
VITE_ANTHROPIC_API_KEY = sk-ant-xxxx...
```

### Netlify

Connect your GitHub repo to Netlify, set env vars in Site Settings → Build & Deploy, auto-deploys on push.

### Docker (Self-Hosted)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

```bash
docker build -t oncology-cdss .
docker run -p 3000:3000 -e VITE_ANTHROPIC_API_KEY=sk-ant-... oncology-cdss
```

---

## ⚠️ Medical & Legal Disclaimer

**IMPORTANT:** This software is for **educational and research purposes only**. It is **NOT intended for clinical decision-making in real patient care** without:

1. **Proper Medical Oversight** — Licensed oncologists must review and authorize all recommendations
2. **Regulatory Approval** — System must comply with FDA/HIPAA/local healthcare regulations
3. **Clinical Validation** — Model performance must be validated in clinical trials
4. **Informed Consent** — Patients must be informed of AI-assisted decision support

**Liability:** The creators assume **no liability** for clinical decisions made using this system. All recommendations require human clinician authorization before implementation.

---

## 🐛 Troubleshooting

### Issue: "VITE_ANTHROPIC_API_KEY not set"

**Solution:** Ensure `.env.local` file exists with:
```
VITE_ANTHROPIC_API_KEY=sk-ant-xxxx...
```

### Issue: "API: invalid_request_error"

**Solution:** Verify API key is valid and has sufficient credits at [console.anthropic.com](https://console.anthropic.com)

### Issue: "JSON parse failed"

**Solution:** Check Claude API response format. System attempts multiple JSON recovery strategies.

### Issue: Port 5173 already in use

**Solution:** 
```bash
npm run dev -- --port 3000
```

---

## 📚 References

- [DPYD Testing Guidelines](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3722035/)
- [Calvert Formula for Carboplatin](https://pubmed.ncbi.nlm.nih.gov/11014912/)
- [UGT1A1 & Irinotecan](https://www.fda.gov/drugs/biomarkers-cabinet/ugt1a1)
- [SHAP Explainability](https://shap.readthedocs.io/)

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — See [LICENSE](LICENSE) file for details

---

## 🎓 Academic Context

**Master of Information Management · IM507 Decision Support Systems**

*Built with Claude AI, React, and Vite*

---

**Questions?** Open an issue on GitHub or contact the maintainer.
