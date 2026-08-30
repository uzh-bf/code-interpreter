# ADR 0001: Bind JWT trust policy to issuers

Status: accepted

Date: 2026-08-30

## Context

CodeAPI previously applied one global issuer, audience, algorithm, and key set
to every accepted JWT. Adding another caller to that verifier would allow a key
or principal source intended for one issuer to be combined with another
issuer's claims unless every trust dimension moves together.

The verifier already supports several local key-material sources and bounded
global safety settings. Replacing those mechanisms would add operational risk
without improving the trust boundary.

## Decision

CodeAPI accepts an optional strict `CODEAPI_JWT_TRUST_ENTRIES_JSON` table. Each
entry binds one exact issuer to non-empty accepted audiences, globally unique
key IDs, allowed algorithms, and accepted principal sources.

The verifier uses the unverified issuer only to select a policy. It then checks
the selected policy's algorithm and key ID, verifies the signature, and enforces
the selected audience and principal source before creating a principal.

Existing key-material loaders remain global. In modern mode, every loaded key
belongs to exactly one trust entry. Duplicate, missing, multiply assigned, and
orphan key IDs fail configuration. Clock skew, token lifetime, key-cache
lifetime, and tenant-isolation settings remain global safety controls.

Modern and legacy policy variables are mutually exclusive. When the trust table
is absent, CodeAPI normalizes the existing issuer, audience, algorithms, and
loaded keys into one LibreChat entry accepting `librechat_jwt` and
`openid_reuse`. This preserves the current migration path and key rotation.

## Consequences

- Cross-issuer key, algorithm, audience, and principal-source combinations fail
  closed.
- A future Klicker entry can accept only `klicker_jwt` without changing
  downstream principal semantics.
- Operators must use globally unique key IDs and remove stale legacy policy
  variables before enabling modern mode.
- Existing deployments continue in legacy mode until they opt into the trust
  table.

## Rejected alternatives

- One global policy cannot express separate caller trust boundaries safely.
- Embedding key material in each trust entry duplicates existing secret and
  rotation mechanisms.
- Allowing duplicate key IDs under issuer namespaces makes key selection and
  operational rotation ambiguous across the global loaders.
