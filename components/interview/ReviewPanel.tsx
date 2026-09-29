"use client";

import { AlertTriangle, Check, Copy, MessageCircleQuestion, Quote } from "lucide-react";
import { PROFILE_FIELDS, PROFILE_SECTIONS, splitToArray, type ProfileFieldSpec } from "@/lib/profile-fields";
import { canMerge, compareField, mergeValue, type Extraction, type ExtractedField, type FieldStatus, type Revision } from "@/lib/interview-import";
import { notify } from "@/components/ui/feedback";

export type Mode = "new" | "merge" | "keep";

export interface FieldDraft {
  include: boolean;
  mode: Mode;
  /** 编辑框里的文字；多选题用顿号隔开 */
  text: string;
}

const SPEC = new Map(PROFILE_FIELDS.map((f) => [f.key, f]));
const show = (v: unknown) => (Array.isArray(v) ? v.join("、") : typeof v === "string" ? v : "");

/** 确认页每一项的初始状态：原来空着的直接勾上；一样的不用动；不一样的，能合并就合并，不能就先保留原来的 */
export function initialDrafts(ex: Extraction, existing: Record<string, unknown> | null): Record<string, FieldDraft> {
  const out: Record<string, FieldDraft> = {};
  for (const f of ex.fields) {
    const status = compareField(f, existing);
    const text = show(f.value);
    if (status === "new") out[f.key] = { include: true, mode: "new", text };
    else if (status === "same") out[f.key] = { include: false, mode: "keep", text };
    else out[f.key] = canMerge(f.key) ? { include: true, mode: "merge", text } : { include: false, mode: "keep", text };
  }
  return out;
}

/** 按用户在确认页的选择，算出要写进档案的字段 */
export function buildPatch(
  ex: Extraction,
  drafts: Record<string, FieldDraft>,
  existing: Record<string, unknown> | null
): Record<string, string | string[]> {
  const patch: Record<string, string | string[]> = {};
  for (const f of ex.fields) {
    const d = drafts[f.key];
    if (!d?.include || d.mode === "keep" || !d.text.trim()) continue;
    const spec = SPEC.get(f.key)!;
    const value = spec.kind === "multi" ? splitToArray(d.text) : d.text.trim();
    patch[f.key] = d.mode === "merge" ? mergeValue(f.key, existing?.[f.key], value) : value;
  }
  return patch;
}

/** 确认页此刻的结果（手动改过的以编辑框为准），发给"跟 AI 说"用 */
export function currentValues(ex: Extraction, drafts: Record<string, FieldDraft>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const f of ex.fields) {
    const text = drafts[f.key]?.text ?? show(f.value);
    out[f.key] = SPEC.get(f.key)?.kind === "multi" ? splitToArray(text) : text;
  }
  return out;
}

/**
 * 把 AI 按编导的话改出来的结果合进确认页。
 * 编导明确说了的项直接勾上：原来空着的写进去；和档案不一样的，多选合并、单选和填空用新的
 * （和刚提取时"先保留原来的"不同——这回是编导自己说的）。
 */
export function applyRevision(
  ex: Extraction,
  drafts: Record<string, FieldDraft>,
  rev: Revision,
  existing: Record<string, unknown> | null
): { extraction: Extraction; drafts: Record<string, FieldDraft> } {
  const byKey = new Map(ex.fields.map((f) => [f.key, f]));
  const nextDrafts = { ...drafts };
  for (const k of rev.remove) {
    byKey.delete(k);
    delete nextDrafts[k];
  }
  for (const f of rev.set) {
    byKey.set(f.key, f);
    const status = compareField(f, existing);
    const text = show(f.value);
    nextDrafts[f.key] =
      status === "same"
        ? { include: false, mode: "keep", text }
        : { include: true, mode: status === "different" && canMerge(f.key) ? "merge" : "new", text };
  }
  const order = new Map(PROFILE_FIELDS.map((f, i) => [f.key, i]));
  const fields = [...byKey.values()].sort((a, b) => order.get(a.key)! - order.get(b.key)!);
  return {
    extraction: {
      ...ex,
      fields,
      profileName: rev.profileName ?? ex.profileName,
      highlights: rev.highlights ?? ex.highlights,
      // 补上了的就不用再补问
      missing: ex.missing.filter((m) => !byKey.has(m.key)),
    },
    drafts: nextDrafts,
  };
}

interface Props {
  extraction: Extraction;
  existing: Record<string, unknown> | null;
  drafts: Record<string, FieldDraft>;
  onDraft: (key: string, d: FieldDraft) => void;
  highlights: boolean[];
  onHighlight: (i: number, on: boolean) => void;
}

export function ReviewPanel({ extraction, existing, drafts, onDraft, highlights, onHighlight }: Props) {
  const byKey = new Map(extraction.fields.map((f) => [f.key, f]));

  return (
    <div className="space-y-5">
      {PROFILE_SECTIONS.map((section) => {
        const rows = section.fields.map((s) => byKey.get(s.key)).filter((x): x is ExtractedField => !!x);
        if (rows.length === 0) return null;
        return (
          <section key={section.title} className="glass-panel rounded-2xl p-4 sm:p-5">
            <h3 className="text-[15px] font-semibold text-foreground">{section.title}</h3>
            <div className="mt-3 divide-y divide-border/60">
              {rows.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  spec={SPEC.get(f.key)!}
                  status={compareField(f, existing)}
                  current={show(existing?.[f.key])}
                  draft={drafts[f.key]}
                  onDraft={(d) => onDraft(f.key, d)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {extraction.highlights.length > 0 && (
        <section className="glass-panel rounded-2xl p-4 sm:p-5">
          <h3 className="text-[15px] font-semibold text-foreground">前采要点</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            档案里没有对应的栏，但做定位、写内容用得上。勾上的会存进档案，做账号定位时一起参考。
          </p>
          <ul className="mt-3 space-y-2">
            {extraction.highlights.map((h, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] text-foreground">
                  <input
                    type="checkbox"
                    checked={highlights[i] ?? true}
                    onChange={(e) => onHighlight(i, e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>{h}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {extraction.missing.length > 0 && <MissingList missing={extraction.missing} />}
    </div>
  );
}

const STATUS_BADGE: Record<FieldStatus, { text: string; cls: string }> = {
  new: { text: "新增", cls: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  same: { text: "和档案一致", cls: "bg-foreground/[0.06] text-muted-foreground" },
  different: { text: "和档案不一样", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

function FieldRow({
  field,
  spec,
  status,
  current,
  draft,
  onDraft,
}: {
  field: ExtractedField;
  spec: ProfileFieldSpec;
  status: FieldStatus;
  current: string;
  draft: FieldDraft | undefined;
  onDraft: (d: FieldDraft) => void;
}) {
  if (!draft) return null;
  const badge = STATUS_BADGE[status];
  const inputCls =
    "w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-[13.5px] text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

  return (
    <div className="py-3.5 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "same" && (
          <input
            type="checkbox"
            checked={draft.include}
            onChange={(e) => onDraft({ ...draft, include: e.target.checked, mode: e.target.checked && draft.mode === "keep" ? (canMerge(field.key) ? "merge" : "new") : draft.mode })}
            aria-label={`写入「${spec.label}」`}
            className="h-4 w-4 accent-primary"
          />
        )}
        <span className="text-[13.5px] font-medium text-foreground">{spec.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${badge.cls}`}>{badge.text}</span>
        {field.byUser && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] text-primary">
            <Check className="h-3 w-3" /> 按你说的改了
          </span>
        )}
        {field.unverified && !field.byUser && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400" title="依据在原文里对不上，可能是 AI 归纳的，请核对">
            <AlertTriangle className="h-3 w-3" /> 需核对
          </span>
        )}
      </div>

      {status === "same" ? (
        <p className="mt-1.5 text-[13px] text-muted-foreground">{current}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {spec.kind === "single" ? (
            <select
              value={draft.text}
              disabled={!draft.include}
              onChange={(e) => onDraft({ ...draft, text: e.target.value })}
              className={inputCls}
            >
              {(spec.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft.text}
              disabled={!draft.include}
              onChange={(e) => onDraft({ ...draft, text: e.target.value })}
              className={inputCls}
            />
          )}

          {status === "different" && (
            <div className="rounded-xl bg-foreground/[0.03] px-3 py-2 text-[12.5px]">
              <div className="text-muted-foreground">
                档案里现在是：<span className="text-foreground">{current}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(canMerge(field.key) ? (["merge", "new", "keep"] as Mode[]) : (["new", "keep"] as Mode[])).map((m) => {
                  const on = draft.include ? draft.mode === m : m === "keep";
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onDraft({ ...draft, include: m !== "keep", mode: m })}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${on ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {on && <Check className="h-3 w-3" />}
                      {m === "merge" ? "两边合并" : m === "new" ? "用新的" : "保留原来的"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {field.evidence && (
        <p className="mt-2 flex gap-1.5 text-[12px] leading-relaxed text-muted-foreground">
          <Quote className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
          <span>{field.evidence}</span>
        </p>
      )}
    </div>
  );
}

/** 补问清单：前采没问到、但定位很需要的。编导复制下来，下次回访照着问 */
export function MissingList({ missing }: { missing: Extraction["missing"] }) {
  const copy = async () => {
    const text = missing.map((m, i) => `${i + 1}. ${m.question}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify("已复制，下次回访照着问", "success");
    } catch {
      notify("复制失败，请手动选中复制", "error");
    }
  };
  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
          <MessageCircleQuestion className="h-4 w-4 text-primary" /> 补问清单
        </h3>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] text-primary hover:bg-primary/10"
        >
          <Copy className="h-3.5 w-3.5" /> 复制问题
        </button>
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">这次前采没问到、但做定位很需要。下次回访照着问，问完再导入一次就补齐了。</p>
      <ol className="mt-3 space-y-2.5">
        {missing.map((m, i) => (
          <li key={m.key} className="text-[13.5px]">
            <span className="text-muted-foreground">{i + 1}. {m.label}</span>
            <div className="mt-0.5 text-foreground">{m.question}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
