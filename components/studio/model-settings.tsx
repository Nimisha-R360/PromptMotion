"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type LlmProvider, type LlmSettings, type LlmSettingsPatch } from "@/lib/client/api";

const PROVIDERS: { id: LlmProvider; label: string; hint: string }[] = [
  { id: "local", label: "Local model (llama.cpp)", hint: "Runs on this machine. Start it with: npm run llm" },
  { id: "anthropic", label: "Claude (Anthropic)", hint: "Uses your Anthropic API key — get one at console.anthropic.com" },
  { id: "openai", label: "ChatGPT (OpenAI)", hint: "Uses your OpenAI API key — get one at platform.openai.com" },
];

/** Choose which model the agents run on; cloud providers need the user's own API key (stored server-side, never sent back). */
export function ModelSettingsDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void }) {
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [provider, setProvider] = useState<LlmProvider>("local");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .llmSettings()
      .then((s) => {
        setSettings(s);
        setProvider(s.provider);
        setKey("");
        setModel(s.provider === "anthropic" ? s.anthropicModel : s.provider === "openai" ? s.openaiModel : "");
      })
      .catch((e) => toast.error(`Could not load model settings: ${e.message}`));
  }, [open]);

  const pick = (p: LlmProvider) => {
    setProvider(p);
    setKey("");
    setModel(p === "anthropic" ? (settings?.anthropicModel ?? "") : p === "openai" ? (settings?.openaiModel ?? "") : "");
  };

  const hasKey = provider === "anthropic" ? settings?.hasAnthropicKey : provider === "openai" ? settings?.hasOpenaiKey : true;
  const cloud = provider !== "local";

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
    }
    void save(patch);
  };

  const removeKey = () => {
    const patch: LlmSettingsPatch = provider === "anthropic" ? { anthropicApiKey: "", provider: "local" } : { openaiApiKey: "", provider: "local" };
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
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={hasKey ? "•••••••• saved — leave empty to keep it" : provider === "anthropic" ? "sk-ant-…" : "sk-…"}
                />
                <span className="text-[11px] text-muted-foreground">Stored only in this app&apos;s local database, never shown again.</span>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium">Model</span>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "anthropic" ? "claude-opus-5-5" : "gpt-5"} />
              </label>
            </>
          )}
        </div>

        <DialogFooter>
          {cloud && hasKey && (
            <Button variant="ghost" size="sm" disabled={saving} onClick={removeKey} className="mr-auto text-muted-foreground">
              Remove key
            </Button>
          )}
          <Button size="sm" disabled={saving || !settings || (cloud && !hasKey && !key.trim())} onClick={submit}>
            {saving && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
