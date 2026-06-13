# 🦾 PROX-RECYCLE: Eco-Bounty Platform (Hackathon Edition)

Este documento detalha a arquitetura, a visão e o estado atual do projeto **Prox-Recycle** (anteriormente Eco-Bounty), uma plataforma gamificada de reciclagem urbana projetada para mercados emergentes, com foco inicial no setor de gestão de resíduos em Angola.

---

## 🎯 A Ideia Geral (O "Vibe")
O Prox-Recycle é uma plataforma **Cyber-Eco**. A ideia é transformar o ato de reciclar em uma atividade lucrativa e tecnicamente avançada, similar a um jogo de "Bounty Hunting" (Caça a Recompensas). 

Os usuários (Agentes) utilizam um mapa tático para localizar "nós de resíduos" (Bounties) na cidade. Ao coletar esses materiais, eles usam a câmera do celular com inteligência artificial para validar o carregamento e receber créditos (Kanzas) instantaneamente em suas carteiras digitais, que podem ser transferidos para serviços como Unitel Money.

---

## 🛠️ O Que Já Foi Implementado

### 1. Núcleo do Sistema (Backend & Auth)
- **Integração Firebase Enterprise:** Configuração completa de um banco de dados NoSQL multi-usuário.
- **Autenticação Segura:** Sistema de login via Google e tratamento de erros para operações restritas.
- **Regras de Segurança (8 Pillars):** Regras de Firestore implantadas e endurecidas para proteger transações financeiras.

### 2. Interface do Usuário (Frontend)
- **Mapa Tático (MapView):** Interface que exibe recompensas disponíveis em tempo real com efeitos de "Calor" e Pins dinâmicos.
- **Scanner IA (Gemini Vision API):** Integração com o modelo Gemini para análise de imagens baseada em visão computacional. O sistema identifica:
  - Tipo de material (PET, Alumínio, etc.).
  - Fraudes (fotos falsas ou objetos irrelevantes).
  - Estimativa de peso e valor de recompensa.

### 3. Economia e Gamificação
- **Wallet Hub:** Carteira digital para rastreio de ganhos.
- **Meta Diária de Impacto:** Barra de progresso baseada em peso (KG) para incentivar a reciclagem contínua.
- **Simulação de Saque:** Fluxo de transferência simulado para Unitel Money/Mobile Money.
- **Leaderboard (Ranking):** Sistema de ranking global entre "Agentes de Setor" baseado na massa total reciclada.

---

## 🚧 O Que Falta Implementar (Roadmap Preferencial)

1. **Gestão de Inventário (Warehouse Nodes):**
   - Atualmente, os usuários "finalizam" o bounty no scanner. O ideal seria um estado intermediário onde o usuário precisa levar o material até um ponto de coleta física (Warehouse) para um "QR Code Handshake".

2. **IA de Densidade (Deteção de Quantidade):**
   - Melhorar o prompt da IA para contar múltiplas garrafas em um fardo e não apenas identificar o material.

3. **Sistema de Níveis e Badges:**
   - Implementar conquistas reais (ex: "Elite Scrapper", "Aluminum Master") que dão multiplicadores de recompensa permanentes.

4. **Notificações Push (Intel Alerts):**
   - Notificar usuários quando um "Surge" (aumento de preço) ocorrer em um setor próximo a eles.

5. **Interface de Administrador:**
   - Um painel (Dashboard de Gestão de Resíduos) para empresas de saneamento verem onde há maior concentração de coleta na cidade.

---

## 🏗️ Arquitetura Técnica
- **Framework:** React 18 + Vite.
- **Estilização:** Tailwind CSS (Tema Dark/Cyberpunk).
- **Animações:** `motion/react` (AnimatePresence para transições suaves).
- **Banco de Dados:** Cloud Firestore.
- **Inteligência Artificial:** Google Gemini 3 Flash Preview (SDK @google/genai).

---
*Este documento foi gerado para documentar a evolução técnica do protótipo no ambiente AI Studio Build.*
