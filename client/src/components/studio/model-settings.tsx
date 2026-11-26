import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type LlmProvider, type LlmSettings, type LlmSettingsPatch } from "@/lib/api";

const PROVIDERS: { id: LlmProvider; label: string; hint: string }[] = [
  { id: "local", label: "Local model (llama.cpp)", hint: "Runs on this machine. Start it with: npm run llm" },
  { id: "anthropic", label: "Claude (Anthropic)", hint: "Uses your Anthropic API key — get one at console.anthropic.com" },
  { id: "openai", label: "ChatGPT (OpenAI)", hint: "Uses your OpenAI API key — get one at platform.openai.com" },
  { id: "groq", label: "Groq", hint: "Uses your Groq API key — get one at console.groq.com" },
];

/** Choose which model the agents run on; cloud providers need the user's own API key (stored server-side, never sent back). */
export function ModelSettingsDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void }) {
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [provider, setProvider] = useState<LlmProvider>("local");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  /** result of the last key validation for the current inputs (cleared when they change) */
  const [check, setCheck] = useState<{ state: "checking" | "ok" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    api
      .llmSettings()
      .then((s) => {
        setSettings(s);
        setProvider(s.provider);
        setKey("");
        setCheck(null);
        setModel(s.provider === "anthropic" ? s.anthropicModel : s.provider === "openai" ? s.openaiModel : s.provider === "groq" ? s.groqModel : "");
      })
      .catch((e) => toast.error(`Could not load model settings: ${e.message}`));
  }, [open]);

  const pick = (p: LlmProvider) => {
    setProvider(p);
    setKey("");
    setCheck(null);
    setModel(
      p === "anthropic" ? (settings?.anthropicModel ?? "") : p === "openai" ? (settings?.openaiModel ?? "") : p === "groq" ? (settings?.groqModel ?? "") : "",
    );
  };

  const hasKey =
    provider === "anthropic" ? settings?.hasAnthropicKey : provider === "openai" ? settings?.hasOpenaiKey : provider === "groq" ? settings?.hasGroqKey : true;
  const cloud = provider !== "local";

  /** Validates the key + model with one tiny real request (nothing is saved). */
  const testKey = async () => {
    if (provider === "local") return true;
    setCheck({ state: "checking", message: "Checking the key with a test request…" });
    try {
      const r = await api.validateLlmKey({ provider, apiKey: key.trim() || undefined, model: model.trim() || undefined });
      setCheck(r.ok ? { state: "ok", message: `Key is valid — ${r.model} responded.` } : { state: "error", message: r.error ?? "This key could not be verified." });
      return r.ok;
    } catch (e) {
      setCheck({ state: "error", message: (e as Error).message });
      return false;
    }
  };

  const save = async (patch: LlmSettingsPatch) => {
    setSaving(true);
    try {
      const s = await api.saveLlmSettings(patch);
      setSettings(s);
      setKey("");
      toast.success(`Agents now use ${PROVIDERS.find((p) => p.id === s.provider)?.label ?? s.provider}`);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      // the server validates the key before saving; show why it was refused next to the key field
      if (patch.provider && patch.provider !== "local") setCheck({ state: "error", message: (e as Error).message });
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    const patch: LlmSettingsPatch = { provider };
    if (provider === "anthropic") {
      if (key.trim()) patch.anthropicApiKey = key.trim();
      patch.anthropicModel = model.trim();
    } else if (provider === "openai") {
      if (key.trim()) patch.openaiApiKey = key.trim();
      patch.openaiModel = model.trim();
    } else if (provider === "groq") {
      if (key.trim()) patch.groqApiKey = key.trim();
      patch.groqModel = model.trim();
    }
    void save(patch);
  };

  const removeKey = () => {
    const patch: LlmSettingsPatch =
      provider === "anthropic"
        ? { anthropicApiKey: "", provider: "local" }
        : provider === "groq"
          ? { groqApiKey: "", provider: "local" }
          : { openaiApiKey: "", provider: "local" };
    void save(patch);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agent model</DialogTitle>
          <DialogDescription>Choose the model the Director and designer agents use.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium">Provider</span>
            <Select value={provider} onValueChange={(v) => pick(v as LlmProvider)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">{PROVIDERS.find((p) => p.id === provider)?.hint}</span>
          </label>

          {cloud && (
            <>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium">API key</span>
                <Input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    setCheck(null);
                  }}
                  placeholder={hasKey ? "•••••••• saved — leave empty to keep it" : provider === "anthropic" ? "sk-ant-…" : provider === "groq" ? "gsk_…" : "sk-…"}
                />
                <span className="text-[11px] text-muted-foreground">Stored only in this app&apos;s local database, never shown again.</span>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium">Model</span>
                <Input
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setCheck(null);
                  }} placeholder={provider === "anthropic" ? "claude-opus-5-5" : provider === "groq" ? "openai/gpt-oss-120b" : "gpt-5"} />
              </label>
              {check && (
                <p
                  role="status"
                  aria-live="polite"
                  className={
                    "flex items-start gap-1.5 text-xs " +
                    (check.state === "ok" ? "text-emerald-500" : check.state === "error" ? "text-destructive" : "text-muted-foreground")
                  }
                >
                  {check.state === "checking" ? (
                    <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
                  ) : check.state === "ok" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0" />
                  )}
                  <span>{check.message}</span>
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {cloud && hasKey && (
            <Button variant="ghost" size="sm" disabled={saving} onClick={removeKey} className="mr-auto text-muted-foreground">
              Remove key
            </Button>
          )}
          {cloud && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving || check?.state === "checking" || !settings || (!hasKey && !key.trim())}
              onClick={() => void testKey()}
            >
              {check?.state === "checking" && <Loader2 className="animate-spin" />} Test key
            </Button>
          )}
          <Button size="sm" disabled={saving || check?.state === "checking" || !settings || (cloud && !hasKey && !key.trim())} onClick={submit}>
            {saving && <Loader2 className="animate-spin" />} {saving && cloud ? "Validating…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
