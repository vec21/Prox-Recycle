# 🦾 Prox-Recycle — Eco-Bounty Platform

> **Agents League Hackathon 2026 · Track: 🎨 Creative App · Microsoft IQ: Foundry IQ**

A **Cyber-Eco** gamified recycling platform for emerging markets (initial focus: Angola).
Citizens become *Agents* who hunt waste "bounties" on a tactical map, scan their haul
with an AI camera, and earn **Kanza (Kz)** credits payable to mobile money wallets
(e.g. Unitel Money).

Every reward is **grounded and citation-backed by Microsoft Foundry IQ** — so payouts
are auditable, traceable, and resistant to hallucination.

---

## 💡 Microsoft IQ Integration — Foundry IQ

This project integrates the **Foundry IQ** intelligence layer (Azure AI Foundry):
*"agentic knowledge retrieval that delivers cited, grounded answers to reduce hallucination."*

| Where | How Foundry IQ is used |
|-------|------------------------|
| **AI Waste Scan** | A deployed multimodal model classifies the material, count, weight and detects fraud. |
| **Reward Agent** | The model is **grounded** in a recycling knowledge base ([server/knowledge/recycling-knowledge.md](server/knowledge/recycling-knowledge.md)) — material prices, fraud rules, CO₂ factors, Angola compliance notes. |
| **Citations** | Every scan returns the knowledge-base entry IDs it relied on (e.g. `PRICE-PET`, `CO2-ALU`, `FRAUD-STOCK`), shown live in the scanner UI. |

This makes each reward **explainable**: the agent never invents a price — it cites the
ground-truth entry that justifies the payout.

> The Foundry call lives server-side ([server/foundry.ts](server/foundry.ts)) so credentials
> are **never exposed to the browser**. Without credentials the app runs in a deterministic
> **mock grounding** mode, so reviewers can demo the full flow with zero Azure setup.

---

## 🏗️ Architecture

```
┌─────────────┐   POST /api/scan    ┌──────────────────┐   Chat Completions   ┌──────────────────┐
│ ScannerView │ ── base64 image ──▶ │  Express backend  │ ───────────────────▶ │ Azure AI Foundry │
│   (React)   │ ◀─ JSON+citations ─ │  (keys stay here) │ ◀── grounded JSON ── │   + Foundry IQ   │
└─────────────┘                     └──────────────────┘                      └──────────────────┘
        │                                    │  grounds against
        │ Firestore (claims, wallet)         ▼
        ▼                          recycling-knowledge.md
   Firebase Auth + Cloud Firestore   (prices, fraud, CO₂, regs)
```

- **Frontend:** React 19 + Vite + Tailwind (Cyberpunk theme), `motion/react` animations
- **Backend:** Express ([server/](server/)) — holds Foundry credentials, exposes `/api/scan`
- **AI:** Azure AI Foundry multimodal model + **Foundry IQ** grounding
- **Data:** Firebase Auth + Cloud Firestore (bounties, claims, wallet, leaderboard)

---

## ✨ Features

- 🗺️ **Tactical Bounty Map** — live recycling targets with surge pricing
- 📸 **Grounded AI Scanner** — material, weight, fraud detection + **Foundry IQ citations**
- 🌱 **Impact tracking** — CO₂ saved per claim, grounded in the knowledge base
- 💸 **Wallet Hub** — Kanza balance + simulated mobile-money cash-out
- 🏆 **Leaderboard** — global ranking by total mass recycled

---

## 🚀 Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Enable live Foundry IQ — copy `.env.example` to `.env` and fill in your
   Azure AI Foundry endpoint, key and deployment. **Skip this to run in mock mode.**
   ```bash
   cp .env.example .env
   ```
3. Run web + backend together:
   ```bash
   npm run dev
   ```
   - Web: http://localhost:3000
   - API: http://localhost:8787 (health check: `/api/health`)

---

## 🔑 Setting up Foundry IQ (Azure AI Foundry)

1. Create a free **Azure account** → https://azure.microsoft.com/free
2. Open the **Foundry portal** → https://ai.azure.com and create a resource + project.
3. Deploy a **multimodal model** (e.g. `gpt-4.1`).
4. Copy the **endpoint**, **API key** and **deployment name** into `.env`:
   ```env
   FOUNDRY_ENDPOINT="https://<your-resource>.openai.azure.com"
   FOUNDRY_API_KEY="<your-key>"
   FOUNDRY_DEPLOYMENT="gpt-4.1"
   ```
5. Restart `npm run dev`. The scanner now shows **`Grounded_by_Foundry_IQ`**.

> To take grounding further, attach `recycling-knowledge.md` as a **Foundry IQ knowledge
> source** to a Foundry Agent in the portal and point the backend at that agent.

---

## 🔒 Security & Disclaimer

- No secrets are committed — `.env*` is git-ignored (see [.gitignore](.gitignore)).
- All AI keys stay **server-side**; the browser only talks to the local API.
- Do **not** upload confidential information (per the hackathon Disclaimer).

---

## 📂 Project Structure

```
server/
  index.ts                     # Express API (keeps credentials server-side)
  foundry.ts                   # Foundry IQ grounding + mock fallback
  knowledge/
    recycling-knowledge.md     # Foundry IQ grounding source (prices, rules, CO₂)
src/
  App.tsx
  components/                  # MapView, ScannerView, WalletView, Leaderboard, Settings
  lib/
    foundry.ts                 # Frontend API client (no keys)
    bountyService.ts           # Firestore logic (grounded rewards)
    firebase.ts
```

---

## 🎯 Hackathon Checklist

- [x] Integrates a Microsoft IQ layer (**Foundry IQ**)
- [x] Grounded, citation-backed AI (Reliability & Safety)
- [x] Credentials secured server-side
- [x] Public repo + README
- [ ] Demo video
