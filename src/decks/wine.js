// Wine card types. Moved verbatim out of src/app.js; the direction rule and the
// face layouts are unchanged.
//
// Nothing here flips. The front is always a place or a label and the back is
// always the grape, its region and its notes. `decode` used to also run
// backwards -- show grape, region and notes, ask you to name the wine -- but
// that has no single answer: plenty of appellations share a grape and a region.
// The reverse face is kept below so the direction can be restored in one place.
import { specHeadline, specDetail } from "./specs.js";

export const place2grape = {
  reversible: () => false,
  label: c => c.grape,
  hint: c => c.region,
  faces: c => ({
    prompt: specDetail(c.region, c.country, c.notes, "Place & taste", "Which grape?"),
    answer: specHeadline(c.grape, "Grape"),
  }),
};

export const decode = {
  reversible: () => false,
  label: c => c.appellation,
  hint: c => c.grape,
  faces: (c, dir) => {
    const appPrompt = specHeadline(c.appellation, "On the label", "Grape & region?", c.trap);
    const detAnswer = specDetail(c.grape, c.country + "  ·  " + c.region, c.notes, "What's in it", "");
    if (dir !== "rev") return { prompt: appPrompt, answer: detAnswer };

    // Unreachable while reversible() returns false.
    const appAnswer = specHeadline(c.appellation, "On the label", "", c.trap);
    const detPrompt = specDetail(c.grape, c.country + "  ·  " + c.region, c.notes, "What's in it", "Name the wine");
    return { prompt: detPrompt, answer: appAnswer };
  },
};

// Retired: its front was a grape, which is not a place or a label, and its own
// answer listed several regions. Kept so uncommenting the generator restores it.
export const grapehome = {
  reversible: () => false,
  label: c => c.grape,
  hint: c => c.home,
  faces: c => ({
    prompt: specHeadline(c.grape, "Grape", "Where's it grown?"),
    answer: specDetail(c.home, "", "Also grown: " + c.also, "Its home"),
  }),
};
