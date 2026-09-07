// California plant families. Four card types, none of them reversible, and the
// reason is the same one that keeps the wine deck one-directional: the back of
// these cards does not determine the front.
//
//   floral     a named flower -> its floral diagram and formula
//   feature    a diagnostic character -> what it is called
//   idclue     a set of field observations -> the family they key out to
//   checklist  a family -> the characters that give it away
//
// The diagrams are drawn from the numbers in the card, in ./figures.js.
import { specHeadline, specDetail, specList, specFigure } from "./specs.js";
import { floralDiagram, shapeFigure } from "./figures.js";

const title = c => c.family + " — " + c.form;

// { family, common, form, formula, diagram, note }
//
// Not reversible. Going diagram -> family looks tempting and is wrong: a bare
// radial five-merous diagram fits Polemoniaceae, Boraginaceae and a dozen
// families outside this deck. The drawing is a summary of a family you have
// already named, not a key to it -- `idclue` is the card that keys.
export const floral = {
  reversible: () => false,
  label: c => title(c),
  hint: c => c.formula,
  faces: c => ({
    prompt: specHeadline(title(c), c.common, "Draw the flower"),
    answer: specFigure("", c.formula, () => floralDiagram(c.diagram), c.note, c.common),
  }),
};

// { term, kind, description, shape?, where, note? }
//
// The description is the prompt, because naming what you are looking at is the
// direction that does the work in the field. Not reversible: several of these
// terms are near neighbours (achene, cypsela, nutlet), so term -> description
// would have more than one defensible answer.
export const feature = {
  reversible: () => false,
  label: c => c.term,
  hint: c => c.where,
  faces: c => ({
    prompt: c.shape
      ? specFigure("", "", () => shapeFigure(c.shape), c.description, c.kind, "Name it")
      : specDetail("", "", c.description, c.kind, "Name it"),
    answer: specDetail(c.term, c.where, c.note || "", c.kind),
  }),
};

// { family, common, clues: [[aspect, observation], ...], example, note? }
//
// The real skill: read the plant, land on the family. Not reversible -- one
// family answers to many different sets of clues, so family -> clues has no
// single right answer.
export const idclue = {
  reversible: () => false,
  label: c => c.family,
  hint: c => c.example,
  faces: c => ({
    prompt: specList("What family?", "field notes", c.clues, "Identify", "Name the family"),
    answer: specDetail(c.family, c.common, (c.note ? c.note + " " : "") + "e.g. " + c.example, "Identify"),
  }),
};

// { family, common, place, rows, genera }
export const checklist = {
  reversible: () => false,
  label: c => c.family,
  hint: c => c.common,
  faces: c => ({
    prompt: specHeadline(c.family, c.common, "What gives it away?"),
    answer: specList(c.family, "the giveaways", c.rows, c.common),
  }),
};
