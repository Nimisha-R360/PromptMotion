# Prompt Motion

Turn a **prompt** or **your slides** into an animated "video", delivered as **one standalone HTML file**.
Every slide is composed from modular animation components built on **Remotion, anime.js, Motion (Framer) and GSAP**. A local **llama.cpp** model plans and designs each slide, and you approve or redesign every slide before moving on.

```
┌──────────── Library ────────────┬──────────── Player ────────────┬──────────── Director ───────────┐
│ 80 components × 4 engines       │ video-like HTML preview        │ chat: outline → slide 1 →       │
│ search / filter / live preview  │ slide / full-video, export     │ approve ✓ or redesign ↻ → …     │
│ "apply to slide" + primitives   │ filmstrip + per-slot inspector │ quick feedback chips, uploads   │
└─────────────────────────────────┴────────────────────────────────┴─────────────────────────────────┘
```

## Run it

```bash
npm run install:all   # installs agents/, backend/ and client/
npm run llm      # terminal 1: local model on :8081 (Qwen2.5-3B-Instruct via llama.cpp)
npm run dev      # terminal 2: builds the player runtime, starts the API (Next.js, :3001) and the UI (Vite, :3000)
```

Open http://localhost:3000. The Vite dev server proxies `/api` to the backend (`BACKEND_URL`, default `http://127.0.0.1:3001`).

Each folder is its own npm package with its own `node_modules` (the root has none: its `package.json` only holds these
shortcut scripts). Install everything with `npm run install:all`. Run one side alone with `npm --prefix backend run dev`
or `npm --prefix client run dev`, and add a package to one side with e.g. `npm --prefix client install <pkg>`.

### Project structure

| Folder | What lives there |
|---|---|
| `client/` | The UI: Vite + React + [shadcn/ui](https://ui.shadcn.com) (`src/components/ui`), the studio panels (`src/components/studio`), the `use-studio` state hook and the typed API client (`src/lib/api.ts`). Imports shared types from the backend via the `@backend/*` alias. |
| `backend/` | Next.js (API route handlers only, `app/api`), the SQLite database layer (`lib/db.ts`, `lib/data`, `db/migrations`, `data/`), parsers, the HTML composer, and the video runtime it bundles (`runtime/`, `components/remocn` · `magicui` · `lottie` · `useanimations`, `scripts/`). |
| `agents/` | Everything model-side: the Director agent (`director/`: Strands harness, tools, model), the slide designer (`designer/`), the LLM providers (`llm.ts`, `llm-providers.ts`), the shared project actions (`actions.ts`) and the local model launcher (`scripts/llm-server.sh`). The backend imports it via `@agents/*`. |

Keyboard: `Ctrl/⌘ K` command palette · `/` focus the message box · `←`/`→` slides · `Alt N` new video · `Esc` stop · `?` all shortcuts.

`npm run llm` uses the native `llama-server` if it's on your PATH. Otherwise it uses `llama-cpp-python` from `./.venv`. To create that venv:

```bash
python3 -m venv --system-site-packages .venv
.venv/bin/pip install "starlette>=0.37.2,<0.39" "sse-starlette==2.1.3" starlette-context pydantic-settings
```

If the model is offline, the app still works: a rule-based designer takes over, and the UI says so.

| env | default | |
|---|---|---|
| `LLM_MODEL_PATH` | `~/models/qwen2.5-3b-q4km.gguf` | GGUF used by `npm run llm` |
| `LLM_BASE_URL` | `http://127.0.0.1:8081/v1` | any OpenAI-compatible llama.cpp server |
| `LLM_TIMEOUT_MS` | `240000` | per request |
| `DATA_DIR` | `backend/data` | SQLite DB + uploaded images |

### Use Claude or ChatGPT instead of the local model

Click the model status in the header to open the model settings: pick **Claude** or **ChatGPT** and paste an API key.
The choice and keys are stored in the local database (`app_settings`), never sent to the browser. Environment
variables work too (in `.env.local`, which git ignores):

| env | default | |
|---|---|---|
| `LLM_PROVIDER` | `local` | `local`, `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | — / `claude-opus-5-5` | Claude |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-5` | ChatGPT |

If the cloud model can't be reached, the app falls back to the rule-based designer, the same way it does when the
local model is offline. See `agents/llm-providers.ts`.

### Why Qwen2.5-3B-Instruct?
`~/models` holds `phi-2.Q4_K_M.gguf` and two byte-identical copies of `qwen2.5-3b(-q4km).gguf` (Qwen2.5-3B-**Instruct**, Q4_K_M).
- Qwen is instruction-tuned and follows JSON schemas reliably. phi-2 is a base model.
- It needs about 2 GB of RAM and runs at roughly 8–15 tok/s on CPU.

Output is **grammar-constrained** (JSON schema → GBNF), so the model can only pick component ids that exist. On CPU:
- an outline takes about 30–50 s;
- a slide design takes about 15–35 s.

## How it works

1. **Prompt mode**:
   - The model writes an outline: slides, layouts, theme, mood. Approve it or give feedback.
   - Then each slide is generated with its content and components, and you **approve or redesign** it.
   - The next slide starts only after approval.
2. **Upload mode** (`.pptx`, `.pdf`, `.md`/`.txt`, or slide images):
   - Your slides' text and images are kept as-is.
   - The model only chooses a layout compatible with the content, plus the animation components.
   - Redesign as often as you like.
3. Redesign feedback is free text:
   - It can name a layout ("use a chart"), a theme ("try sunset") or a mood ("calmer").
   - The rejected design's components are excluded from the next attempt.
4. You can also apply any library component to the current slide manually.
5. **Export** produces a single offline HTML file:
   - The runtime and all four engines are inlined (~430 KB), along with images as data URIs.
   - Only Google Fonts are optional; system fonts are the fallback.
   - It has a video-style player: play/pause, scrubbing with scene markers, loop, fullscreen, and keyboard controls (space, ←/→, f, l).

### Architecture

| Path | What |
|---|---|
| `backend/runtime/registry.ts` | **Component registry**: 80 components (id, engine, category, mood, primitives used) + inventory of 39 framework primitives. Single source of truth for the UI, the LLM schema enums, and the runtime. |
| `backend/runtime/engines/{remotion,anime,motion,gsap}.ts` | Implementations. Each component returns a `seek(t)` so the master clock can scrub every engine frame-accurately (Remotion: pure `f(frame)`; anime.js: `autoplay:false` + `seek`; Motion: paused controls `.time` / spring generators; GSAP: paused timelines). |
| `backend/runtime/scene.ts`, `player.ts` | Slide layouts → DOM + timed tracks; TransitionSeries-style overlapping transitions; player chrome. |
| `backend/scripts/build-runtime.mjs` | esbuild bundle → `runtime-dist/pm-runtime.js` (Remotion's pure modules aliased directly so React isn't bundled). |
| `agents/designer/*` | Prompts, per-layout JSON schemas, normalization, rule-based fallback. |
| `backend/lib/parsers/index.ts` | PPTX (jszip + XML), PDF (pdfjs), Markdown, images. |
| `backend/lib/compose.ts` | Spec → standalone HTML (inlines the remocn host + only the remocn components the video uses, and the Onda bundle only when a slide uses an Onda card or chart). |
| `backend/components/remocn/`, `backend/lib/remocn*/` | Source of the [remocn](https://remocn.dev) registry (React/Remotion components), installed via shadcn. |
| `backend/runtime/remocn/*`, `backend/runtime/engines/remocn.ts` | remocn integration: `manifest.json`/`catalog.json` (generated), the React host that renders a component in a Remotion `<Player>` seeked by the master clock, and the adapter that fills props from slide content + theme. |
| `backend/scripts/remocn-manifest.ts`, `backend/scripts/build-remocn.mjs` | Classify remocn components into slots (title text effects, shader backgrounds, animated-icon decor, full-frame `showcase` scenes) and bundle them into `runtime-dist/remocn/`. |
| `backend/runtime/onda/` | **Onda** components (installed as source with `npx ondajs add`), the add-on that draws them inside slides with Remotion's `<Thumbnail>` (`addon.tsx`), bundled separately → `runtime-dist/pm-onda.js`. `runtime/cards.ts` maps a slide's words to card and chart props. |
| `db/migrations/001_init.sql` | `projects`, `slides` (brief, spec, revision history), `messages`, `assets`. |

### API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/registry` | components, primitives, frameworks, themes, layouts |
| GET | `/api/registry/:id/preview?theme=` | live HTML demo of one component |
| GET | `/api/llm` | local model status |
| GET / POST | `/api/projects` | list / create from prompt `{prompt}` |
| POST | `/api/uploads` | multipart `files[]` (+ `instructions`) → project |
| GET / PATCH / DELETE | `/api/projects/:id` | read / `{theme,title,mood}` / delete |
| POST | `/api/projects/:id/outline` | **SSE**: generate or revise outline `{feedback?}` |
| POST | `/api/projects/:id/outline/approve` | start designing |
| POST | `/api/projects/:id/slides/:i/generate` | **SSE**: design or redesign slide `{feedback?}` |
| POST | `/api/projects/:id/slides/:i/approve` | approve, advance / complete |
| PATCH | `/api/projects/:id/slides/:i` | `{animations:{slot:id}, layout?, duration?, style?, text?, card?}` manual edits (`card`: an Onda card id, or `null` to remove it) |
| GET | `/api/projects/:id/preview?scope=slide&index=` / `scope=all` | player HTML |
| GET | `/api/projects/:id/export[?draft=1]` | download standalone `.html` |

### remocn components

~870 remocn components are available next to the 80 core ones (library filter "remocn"). The designer can't take all of them in its prompt, so each slide gets a short keyword/mood-matched shortlist per slot; ask for "remocn" or name an effect (e.g. "use the remocn mesh gradient background", "show a github stars scene") and the agent applies it. The `showcase` layout is a full-frame remocn scene with a short title. Transition presentations (41) and 16 components whose required props can't be filled from slide content aren't used on slides.

```bash
npm --prefix backend run remocn:manifest   # after adding/updating components in backend/components/remocn
npm --prefix backend run build:runtime     # also builds runtime-dist/remocn (part of dev/build)
```

### Tests

```bash
npm --prefix backend run test:runtime   # headless Chrome: every component implemented + scrubs (forward & backward) without errors
npm --prefix backend run test:remocn    # headless Chrome: every remocn component mounts on its demo slide and scrubs
npm run typecheck && npm run lint && npm run build
```

### Onda cards

The Library's **Cards** section holds four [Onda](https://github.com/degueba/onda) components: Bento Grid, Pricing Card,
Skeleton Card and Spotlight Card. Add one to a slide from the Library; it's filled with the slide's own words (edit them
by clicking the card) and follows the slide's theme colours and fonts.

The **Charts** section also has Onda's data charts: Bar Chart, Line Chart, Pie Reveal and Progress Bars. Applied to a
slide with numbers, they draw those numbers (with values and labels added around Onda's drawing); a stats slide becomes
a chart slide. The AI designer doesn't pick Onda components itself; add them from the Library or ask for one by name
in the chat.

To add another Onda component:

```bash
cd backend && npx ondajs@0.9.2 add <slug> --components-out runtime/onda/components --lib-out runtime/onda/lib
```

then register it in `backend/runtime/cards.ts` (id, where it sits, which slide words fill it), `runtime/onda/addon.tsx` and
`runtime/registry.ts`, and run `npm --prefix backend run build:runtime`.

### Licensing note
Remotion is source-available under the [Remotion License](https://remotion.dev/license). It's free for individuals and companies with up to 3 employees; larger companies need a company license. GSAP (including the bonus plugins), anime.js and Motion are free to use. Onda's code is MIT (© Rodrigo Botelho); the Onda name and logo are not covered by that license.
