# Prox-Recycle Knowledge Base (Angola Market)

This document is the grounding source consumed by the Foundry IQ knowledge layer.
The reward agent must cite entries from this file (by `id`) when computing a payout,
so that every reward is traceable and auditable.

---

## Material Reference Prices (Kwanza per Kg)

> Reference rates for the Luanda scrap market. Values are in Kwanzas (Kz) per kilogram.

- id: PRICE-PET
  material: PET (plastic bottles)
  base_rate_kz_per_kg: 300
  multiplier: 2.0
  notes: Highest demand. Clear/transparent PET pays more than colored.

- id: PRICE-ALU
  material: Aluminum (cans)
  base_rate_kz_per_kg: 450
  multiplier: 2.5
  notes: Best value-to-weight ratio. Clean, uncrushed cans preferred.

- id: PRICE-CARD
  material: Cardboard
  base_rate_kz_per_kg: 80
  multiplier: 1.0
  notes: Must be dry. Wet or soiled cardboard is rejected.

- id: PRICE-GLASS
  material: Glass
  base_rate_kz_per_kg: 60
  multiplier: 1.0
  notes: Sorted by color (clear, green, brown) for best rates.

- id: PRICE-UNKNOWN
  material: Unidentified / Mixed
  base_rate_kz_per_kg: 0
  multiplier: 0
  notes: Items that cannot be classified are not eligible for reward.

---

## Material Classification Guide

- id: CLASS-PET
  category: PET
  identifiers: Resin code 1, transparent flexible bottles, water/soda containers.

- id: CLASS-ALU
  category: Aluminum
  identifiers: Lightweight metal cans, magnet does NOT stick, ring-pull tab.

- id: CLASS-CARD
  category: Cardboard
  identifiers: Corrugated brown paper, boxes, kraft material.

- id: CLASS-GLASS
  category: Glass
  identifiers: Rigid transparent/colored, heavy, bottles and jars.

---

## Fraud & Integrity Rules

- id: FRAUD-STOCK
  rule: Reject stock photos, screenshots, or images pulled from the web.

- id: FRAUD-IRRELEVANT
  rule: Reject images with no recyclable material (people, scenery, pets, food).

- id: FRAUD-DUP
  rule: Reject the same physical pile photographed multiple times for double payout.

- id: FRAUD-LOWCONF
  rule: If classification confidence is below 0.85, flag for manual review.

---

## Environmental Impact Factors (CO2 saved per Kg recycled)

- id: CO2-PET
  material: PET
  co2_saved_kg_per_kg: 1.5

- id: CO2-ALU
  material: Aluminum
  co2_saved_kg_per_kg: 9.0

- id: CO2-CARD
  material: Cardboard
  co2_saved_kg_per_kg: 0.9

- id: CO2-GLASS
  material: Glass
  co2_saved_kg_per_kg: 0.3

---

## Angola Collection & Compliance Notes

- id: REG-LUANDA-01
  note: Collection nodes operate in partnership with municipal saneamento services.
  region: Luanda

- id: REG-PAYOUT-01
  note: Payouts settle to mobile money wallets (e.g. Unitel Money) after node handshake.
  region: National
