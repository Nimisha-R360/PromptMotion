// Generates, from the installed remocn components (components/remocn):
//  - runtime/remocn/manifest.json: per component its export name, the slot category Prompt Motion uses it for, mood
//    tags and a simplified view of its own props (read by scripts/build-remocn.mjs, which embeds the props in each bundle)
//  - runtime/remocn/catalog.json: the usable components without prop details (read by the registry / designer / library)
// Re-run after adding or updating remocn components:  npm run remocn:manifest
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { REMOCN_COMPONENTS } from "../components/remocn/index";
import { MEDIA_LIST_PROPS, MEDIA_PROPS } from "../runtime/remocn/types";

const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "runtime/remocn/manifest.json");
const CATALOG = path.join(root, "runtime/remocn/catalog.json");

type Kind = "string" | "number" | "boolean" | "string[]" | "captions" | "node" | { enum: string[] } | "other";
type Category = "text" | "background" | "decor" | "scene" | "transition";

export interface ManifestEntry {
  id: string;
  file: string;
  export: string;
  category: Category;
  title: string;
  description: string;
  dependencies: string[];
  mood: string[];
  props: Record<string, Kind>;
  required: string[];
  /** false when a required prop can't be filled from slide content (or it is a transition presentation) */
  supported: boolean;
}

const entryFile = (id: string) => {
  const direct = path.join(root, "components/remocn", `${id}.tsx`);
  return fs.existsSync(direct) ? direct : path.join(root, "components/remocn/templates", id, "index.tsx");
};

const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile).config, ts.sys, root);
const files = REMOCN_COMPONENTS.map((c) => entryFile(c.id));
const program = ts.createProgram(files, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

const pascal = (s: string) => s.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

function kindOf(t: ts.Type): Kind {
  const nn = checker.getNonNullableType(t);
  const str = checker.typeToString(nn);
  if (/ReactNode|ReactElement|JSX\.Element/.test(str)) return "node";
  if (nn.isUnion()) {
    if (nn.types.every((x) => x.isStringLiteral())) return { enum: nn.types.map((x) => (x as ts.StringLiteralType).value) };
    if (nn.types.every((x) => x.flags & ts.TypeFlags.BooleanLiteral)) return "boolean";
    return "other";
  }
  if (nn.flags & ts.TypeFlags.String) return "string";
  if (nn.flags & ts.TypeFlags.Number) return "number";
  if (nn.flags & ts.TypeFlags.Boolean) return "boolean";
  if (nn.isStringLiteral()) return { enum: [nn.value] };
  if (checker.isArrayType(nn)) {
    const el = checker.getNonNullableType(checker.getTypeArguments(nn as ts.TypeReference)[0]);
    if (el.flags & ts.TypeFlags.String) return "string[]";
    const names = checker.getPropertiesOfType(el).map((p) => p.name);
    if (names.includes("text") && names.includes("startMs") && names.includes("endMs")) return "captions";
  }
  return "other";
}

const MOODS: [string, RegExp][] = [
  ["calm", /\b(calm|soft|gentle|quiet|slow|drift|fade|subtle|smooth|settle|breath|mist|fog|float)/i],
  ["elegant", /\b(elegant|apple|serif|premium|luxur|refined|graceful|editorial|silk|marble|cinematic|minimal)/i],
  ["techy", /\b(code|terminal|glitch|matrix|decode|ascii|pixel|cli|dev|api|ai|agent|digital|data|deploy|cursor|keystroke|grid|scan|crt|led)/i],
  ["playful", /\b(bounce|pop|playful|wobble|confetti|emoji|sticker|fun|spring|jelly|squash|rubber|party|candy)/i],
  ["bold", /\b(bold|slam|punch|impact|big|giant|heavy|stamp|knockout|strong|loud|massive|shake)/i],
  ["energetic", /\b(fast|burst|energetic|rush|speed|zoom|whip|flash|strobe|explod|launch|race|kinetic|quick)/i],
];
const moodFor = (text: string) => {
  const m = MOODS.filter(([, re]) => re.test(text)).map(([k]) => k);
  return m.length ? m.slice(0, 3) : ["elegant"];
};

/** Required props the player can fill from slide content (title/subtitle/body/bullets) or the scene box size. */
const FILLABLE = new Set(["text", "captions", "children", "fromText", "toText", "title", "label", "width", "height"]);

const out: ManifestEntry[] = [];
const skipped: string[] = [];
for (const c of REMOCN_COMPONENTS) {
  const file = entryFile(c.id);
  const sf = program.getSourceFile(file);
  const mod = sf && checker.getSymbolAtLocation(sf);
  if (!sf || !mod) {
    skipped.push(`${c.id} (no module)`);
    continue;
  }
  const exps = checker.getExportsOfModule(mod);
  const ret = (s: ts.Symbol) => {
    const sig = checker.getTypeOfSymbolAtLocation(s, sf).getCallSignatures()[0];
    return sig ? checker.typeToString(sig.getReturnType()) : "";
  };
  const comps = exps.filter((s) => /^[A-Z]/.test(s.name) && /[a-z0-9]/.test(s.name) && /Element|ReactNode/.test(ret(s)));
  const presentation = exps.find((s) => /^[a-z]/.test(s.name) && /TransitionPresentation/.test(ret(s)));
  const flat = c.id.replace(/-/g, "");
  const main =
    comps.find((s) => s.name === pascal(c.id)) ??
    comps.find((s) => s.name.toLowerCase() === flat) ??
    comps.find((s) => !/Demo$/.test(s.name) && s.name.toLowerCase().includes(flat)) ??
    (c.id.startsWith("icon-") ? comps.find((s) => /Icon$/.test(s.name)) : undefined) ??
    comps[0];
  const isTransition = !!presentation;
  const pick = isTransition ? presentation : main;
  if (!pick) {
    skipped.push(`${c.id} (no component export)`);
    continue;
  }

  const props: Record<string, Kind> = {};
  const required: string[] = [];
  if (!isTransition) {
    const sig = checker.getTypeOfSymbolAtLocation(pick, sf).getCallSignatures()[0];
    const param = sig?.getParameters()[0];
    if (param) {
      const pt = checker.getTypeOfSymbolAtLocation(param, sf);
      for (const p of checker.getPropertiesOfType(pt)) {
        const decl = p.valueDeclaration ?? p.declarations?.[0];
        if (decl && /node_modules/.test(decl.getSourceFile().fileName)) continue; // React/HTML/Remotion props
        props[p.name] = kindOf(checker.getTypeOfSymbolAtLocation(p, sf));
        if (!(p.flags & ts.SymbolFlags.Optional)) required.push(p.name);
      }
    }
  }

  const textual = props.text === "string" || props.captions === "captions" || (props.fromText === "string" && props.toText === "string");
  const category: Category = isTransition
    ? "transition"
    : c.id.startsWith("icon-")
      ? "decor"
      : c.id.startsWith("shader-") && !textual
        ? "background"
        : textual
          ? "text"
          : "scene";
  const supported = !isTransition && required.every((r) => FILLABLE.has(r));
  out.push({
    id: c.id,
    file: path.relative(root, file),
    export: pick.name,
    category,
    title: c.title,
    description: c.description,
    dependencies: c.dependencies,
    mood: moodFor(`${c.id} ${c.title} ${c.description}`),
    props,
    required,
    supported,
  });
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/\},\{"id"/g, '},\n{"id"') + "\n");
// lightweight catalog for the app (registry, library, designer): usable components only, no prop details
const catalog = out
  .filter((e) => e.supported)
  .map((e) => ({
    id: e.id,
    category: e.category,
    title: e.title,
    description: e.description,
    mood: e.mood,
    dependencies: e.dependencies,
    // shows the user's picture(s): "many" = a set of images (grids, reels…), "one" = a single image
    ...(Object.entries(e.props).some(([p, k]) => k === "string[]" && MEDIA_LIST_PROPS.includes(p))
      ? { media: "many" }
      : Object.entries(e.props).some(([p, k]) => k === "string" && MEDIA_PROPS.includes(p))
        ? { media: "one" }
        : {}),
  }));
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 0).replace(/\},\{"id"/g, '},\n{"id"') + "\n");
const by = (k: Category) => out.filter((e) => e.category === k && e.supported).length;
console.log(
  `[remocn] manifest: ${out.length} components → text ${by("text")}, background ${by("background")}, decor ${by("decor")}, scene ${by("scene")}; ` +
    `not usable on slides: ${out.filter((e) => !e.supported).length} (transitions ${out.filter((e) => e.category === "transition").length})` +
    (skipped.length ? `; skipped: ${skipped.join(", ")}` : ""),
);
