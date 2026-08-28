// Render specs: the contract between a deck's card types and the renderer.
// A card type turns a row of deck data into one of these; the renderer knows
// nothing about wine, or Spanish, or anything else.
//
//   headline  one big line            (a label, a word)
//   detail    lead + context + notes  (a place and how it tastes)
//   list      lead + sub + rows       (a conjugation table)

export const specHeadline = (big, kind, ask, warn) =>
  ({ mode: "headline", big, kind, ask: ask || "", warn: !!warn });

export const specDetail = (lead, context, notes, kind, ask) =>
  ({ mode: "detail", lead: lead || "", context: context || "", notes: notes || "", kind, ask: ask || "" });

// `rows` is an array of [left, right] pairs, rendered as an aligned two-column
// table so both faces of a card read the same way.
export const specList = (lead, sub, rows, kind, ask) =>
  ({ mode: "list", lead: lead || "", sub: sub || "", rows: rows || [], kind, ask: ask || "" });
