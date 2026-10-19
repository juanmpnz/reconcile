# Commercial extraction planning — 2026-10-19

Execution: `/root/extract_plan`, independent planning consultation to the principal implementation execution. Roles consulted sequentially within this execution: product-manager, logistics-domain, solution-architect, document-ai-engineer, security-engineer. This is preimplementation guidance, not independent approval of a code diff.

## Evidence examined

Read AGENTS.md, WORKFLOW.md, manifest, the five role profiles, README, architecture overview, implementation plan, pilot requirements and ADR 0008. Inspected `deriveAnalysisFacts`, `analysisLineSchema`, logistics evaluation arithmetic/candidate checks and actual local PDF text plus pdfjs extraction output. Source documents remain outside git. No customer identifiers, prices, contact details or document text are copied into this record.

## Acceptance and limits

- A supported invoice table yields every actual charge row, signed decimal amounts, explicit quantities/units, equipment group and page/row evidence. Subtotals, summaries, headings and footer text are never charges.
- A supported quotation equipment matrix yields alternative rates by equipment, never an aggregate invoice amount. Repeated explanatory sections must not duplicate the same matrix rate.
- Source tariff currency/price is separate from booked invoice currency/amount. Missing exchange rates remain missing. No supplier is invented from a customer, brand, issuing agent or ambiguous company footer.
- Extracted lines do not establish agreement acceptance, date basis, applicable scope, supplier identity or performed services. Existing unknown/contradiction states remain effective.
- PDFs are incomplete transcriptions; successful parsing does not certify completeness or authenticity. No accuracy claim beyond supported bounded layouts.

## Architecture guidance

Keep commercial parsing in document-processing, with header-gated bounded state. The actual PDF text adapter preserves multi-space column separation; support normalized whitespace variants only when column relationships remain unambiguous. Activate table parsing only after a recognized full header, then stop at page/section/summary transitions. Bound field, row and page work to existing contracts.

Add optional structured source-price/currency and FX evidence to the line contract rather than overloading `unitPrice` with an amount in another currency. Invoice `amount`/`currency` retain booked semantics. For differing tariff and booked currencies, do not run `quantity * tariffUnitPrice == bookedAmount`; keep comparison pending unless an explicit compatible conversion is available. Preserve decimal strings and original evidence. Schema additions must remain optional for historic snapshots.

Route evidence must distinguish origin, intermediate/via port and final destination. A port-port quote is not automatically the same scope as an inland-final invoice; never replace the destination with the intermediate port just to obtain a match. Equipment sections scope container rows; a BL row before the equipment section has no container association. Multiple equipment groups retain separate quantities.

Do not infer concept aliases merely from rough text similarity. Generic heading/column parsing may recognize rows without asserting unknown service semantics. Explicit surcharge variability at shipment and package inclusions remain restrictions, not unconditional fixed prices.

## Risks and required negative checks

- High: confusing original foreign tariff price with booked domestic amount causes false arithmetic and economic discrepancies. Verify explicit/no FX separately and preserve both values.
- High: broad row matching can ingest totals or fabricated text as charges. Test header absence, reordered/ambiguous columns, malformed decimals and section transitions.
- High: source provider is not reliably present in every sample; absence must remain reviewable, not hardcoded to a known carrier.
- Medium: repeated matrix sections can duplicate rates; deduplicate only the same supported representation, without suppressing genuinely distinct charges.
- Medium: ambiguous notes and incomplete-source warnings must remain visible and cannot become authoritative tariff amounts.

Only synthetic anonymized fixtures may enter git; alter identities, references, prices, dates and destinations consistently while preserving layout behavior. Expected results stay separate from parser inputs. No external AI/OCR service, network fetch, shell interpretation of document content or document logs are needed.

Status: planning guidance delivered; implementation and post-change QA are outside this execution's scope.
