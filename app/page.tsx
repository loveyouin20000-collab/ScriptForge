"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Download,
  FileText,
  Gauge,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCog,
  Wand2,
  History,
  RotateCcw,
  Save
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ACCOUNTS,
  authenticateAccount,
  canManageUsers,
  createAccount,
  deleteAccount,
  getRemainingRuns,
  parseAccounts,
  recordAccountUsage,
  serializeAccounts,
  updateAccount,
  type Account,
  type AccountDraft
} from "@/lib/accounts";
import { buildChapterReviewItems } from "@/lib/chapterReview";
import { chaptersFromManualText } from "@/lib/chapterSplitter";
import { validateScriptYaml } from "@/lib/schema";
import { getMergedYamlSaveUsage, getProviderUsageCost, getUsageQuota, type UsageQuota } from "@/lib/usageQuota";
import {
  canAdvanceWorkflowStep,
  getCurrentWorkflowSteps,
  type WorkflowDisplayStepId,
  type WorkflowStepId
} from "@/lib/workflow";
import { toYaml } from "@/lib/yaml";
import {
  addYamlVersion,
  createYamlVersion,
  deleteYamlVersion,
  parseYamlVersions,
  serializeYamlVersions,
  updateYamlVersionContent,
  YAML_VERSION_LIMIT,
  type SavedYamlVersion
} from "@/lib/yamlVersions";
import {
  defaultManagedProviders,
  deleteManagedProviderApiKey,
  parseManagedProviders,
  resolveProviderConfig,
  saveManagedProviderApiKey,
  serializeManagedProviders
} from "@/lib/ai/providerCatalog";
import type {
  Chapter,
  ManagedProviderConfig,
  ProviderConfig,
  RevisionScope,
  ScriptLine,
  ScriptYaml,
  ValidationIssue,
  VideoTask
} from "@/lib/types";

type PipelineResult = {
  script: ScriptYaml;
  yaml: string;
  markdown: string;
  chapters: Chapter[];
  validation: {
    valid: boolean;
    issues: ValidationIssue[];
  };
};

type ActiveView = "workflow" | "schema" | "versions" | "pricing" | "users";
type ResultFeatureView = "script" | "storyboard" | "video" | "prompts" | "revision" | "yaml";
type ResultSubView = "overview" | ResultFeatureView;

const ACCOUNTS_STORAGE_KEY = "scriptforge.accounts";
const SESSION_STORAGE_KEY = "scriptforge.sessionAccountId";
const YAML_HISTORY_STORAGE_KEY = "scriptforge.yamlVersions";
const MANAGED_PROVIDERS_STORAGE_KEY = "scriptforge.managedProviders";

const emptyAccountDraft: AccountDraft = {
  username: "",
  password: "",
  role: "user",
  status: "active"
};

function formatVersionTime(createdAt: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(createdAt));
}

const resultSubViews: Array<{ id: ResultFeatureView; label: string }> = [
  { id: "script", label: "剧本编辑" },
  { id: "storyboard", label: "分镜" },
  { id: "video", label: "视频任务" },
  { id: "prompts", label: "Prompt" },
  { id: "revision", label: "反馈回写" },
  { id: "yaml", label: "YAML" }
];

function scriptLineLabel(line: ScriptLine) {
  if (line.type === "dialogue") return `对白 · ${line.character}`;
  if (line.type === "transition") return "转场";
  return "动作";
}

function parseRevisionTarget(value: string): RevisionScope | null {
  const [type, id] = value.split(":");
  if (!type || !id) return null;
  if (!["scene", "shot", "prompt", "video_task"].includes(type)) return null;
  return { type: type as RevisionScope["type"], id };
}

const workflowDisplayOrder: WorkflowDisplayStepId[] = [
  "input",
  "chapters",
  "result",
  "script",
  "storyboard",
  "video",
  "prompts",
  "revision",
  "yaml"
];

const sampleText = `第一章 雨夜归人
雨水顺着老城区咖啡馆的玻璃窗滑落。林晚独自坐在窗边，手机里躺着一条陌生短信：想知道你父亲的真相，今晚别离开。
门铃响起，周沉推门走进来。他看见林晚，像早就知道她会在这里。

第二章 旧案重启
林晚把短信拿给周沉看，周沉却沉默得太久。旧照片从他的口袋里掉出来，照片背面写着父亲失踪前最后去过的车站。
两人决定重启那桩被压下去的旧案。

第三章 消失的证人
清晨的车站空荡得反常。林晚找到当年的值班记录，却发现关键证人的名字被人划掉。
周沉提醒她，有人一直在等他们接近真相。`;

const schemaExample = `metadata:
  title: 示例小说改编剧本
  author: 原作者
  generated_by: ScriptForge AI
  version: "1.0"
source:
  chapter_count: 3
  chapters:
    - id: ch_001
      title: 第一章 雨夜归人
      summary: 本章讲述林晚收到神秘短信。
characters:
  - id: char_001
    name: 林晚
    role: protagonist
    description: 年轻小说作者
locations:
  - id: loc_001
    name: 老城区咖啡馆
    type: interior
    description: 昏暗、安静、带有旧时代气息
timeline:
  - order: 1
    chapter_id: ch_001
    event: 林晚收到神秘短信
    conflict_ids: [conflict_001]
    impact: 引出主线冲突
conflicts:
  - id: conflict_001
    title: 神秘短信引发的对峙
    type: external
    description: 林晚必须判断神秘短信是否与父亲失踪有关。
    parties: [char_001]
    stakes: 判断失误会让旧案线索再次断裂。
    status: active
    source_chapters: [ch_001]
    related_timeline: [1]
story_structure:
  premise: 林晚被一条陌生短信拉回父亲失踪旧案。
  genre: 悬疑剧情
  logline: 年轻小说作者在旧爱协助下追查父亲失踪真相。
  theme: 真相会迫使人重新面对亲密关系。
  main_conflict: 林晚的追查与隐藏真相的人持续对抗。
  dramatic_question: 林晚能否找到父亲失踪的真正原因？
  acts:
    - id: act_001
      name: 开端
      purpose: 建立人物目标和主线悬念
      source_chapters: [ch_001]
      key_events:
        - 林晚收到神秘短信
  conflicts:
    - id: conflict_001
      type: external
      description: 林晚追查旧案时遭遇阻力。
      characters: [char_001]
      source_chapters: [ch_001]
      status: active
  turning_points:
    - id: tp_001
      source_chapter: ch_001
      event: 短信出现
      impact: 林晚决定重新追查旧案。
  character_arcs:
    - character: char_001
      start_state: 逃避旧案
      desire: 找出真相
      obstacle: 信息被人刻意遮蔽
      end_state: 主动踏入调查
scenes:
  - id: scene_001
    title: 雨夜重逢
    source:
      chapters: [ch_001]
    setting:
      location: loc_001
      time: 夜晚
      atmosphere: 悬疑、压抑
    characters: [char_001]
    conflict_ids: [conflict_001]
    purpose: 引出主线悬念
    beats:
      - 林晚独自等待
    script:
      - type: action
        content: 雨水拍打着玻璃窗。`;

type ProviderVendor = ManagedProviderConfig["vendor"];

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) {
    return <p className="muted compact">没有发现结构或引用问题。</p>;
  }
  return (
    <ul className="issueList">
      {issues.map((issue, index) => (
        <li key={`${issue.path}-${index}`}>
          <span>{issue.path}</span>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function StoryStructureSummary({ storyStructure }: { storyStructure: ScriptYaml["story_structure"] }) {
  if (!storyStructure) return null;
  return (
    <section className="panel storyStructurePanel">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Story Structure</p>
          <h2>剧情结构模型</h2>
          <p>作为剧本 YAML 与后续分镜、视频 prompt、反馈重写之间的稳定上游依据。</p>
        </div>
        <span className="moduleState active">{storyStructure.acts.length} 个幕段</span>
      </div>
      <div className="storyStructureGrid">
        <article>
          <h3>核心设定</h3>
          <dl>
            <dt>前提</dt>
            <dd>{storyStructure.premise}</dd>
            <dt>类型</dt>
            <dd>{storyStructure.genre}</dd>
            <dt>一句话梗概</dt>
            <dd>{storyStructure.logline}</dd>
            <dt>主冲突</dt>
            <dd>{storyStructure.main_conflict}</dd>
            <dt>核心悬念</dt>
            <dd>{storyStructure.dramatic_question}</dd>
          </dl>
        </article>
        <article>
          <h3>幕段与转折</h3>
          <ul className="compactList">
            {storyStructure.acts.map((act) => (
              <li key={act.id}>
                <strong>{act.name}</strong>
                <span>{act.purpose}</span>
              </li>
            ))}
          </ul>
          <ul className="compactList">
            {storyStructure.turning_points.map((point) => (
              <li key={point.id}>
                <strong>{point.event}</strong>
                <span>{point.impact}</span>
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>冲突与人物弧</h3>
          <ul className="compactList">
            {storyStructure.conflicts.map((conflict) => (
              <li key={conflict.id}>
                <strong>{conflict.type}</strong>
                <span>{conflict.description}</span>
              </li>
            ))}
            {storyStructure.character_arcs.map((arc) => (
              <li key={arc.character}>
                <strong>{arc.character}</strong>
                <span>
                  {arc.start_state} → {arc.end_state}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function getProviderSelection(provider: ProviderConfig, managedProviders: ManagedProviderConfig[]) {
  const enabledProviders = managedProviders.filter((managedProvider) => managedProvider.enabled);
  const selectedProvider =
    enabledProviders.find((managedProvider) => managedProvider.vendor === provider.vendor) ?? enabledProviders[0];
  const selectedVendor = selectedProvider?.vendor ?? "openai";
  const selectedModel = selectedProvider?.models.includes(provider.model ?? "") ? provider.model ?? "" : selectedProvider?.models[0] ?? "";

  return {
    enabledProviders,
    selectedProvider,
    selectedVendor,
    selectedModel,
    label: selectedProvider?.label ?? "未选择服务商"
  };
}

function ProviderModule({
  provider,
  managedProviders,
  usageQuota,
  onChange
}: {
  provider: ProviderConfig;
  managedProviders: ManagedProviderConfig[];
  usageQuota: UsageQuota;
  onChange: (provider: ProviderConfig) => void;
}) {
  const { enabledProviders, selectedProvider, selectedVendor, selectedModel } = getProviderSelection(
    provider,
    managedProviders
  );
  const readyForRemote = Boolean(selectedProvider?.apiKey && selectedProvider.baseUrl && selectedModel);
  const selectedProviderCost = getProviderUsageCost({ vendor: selectedVendor });

  function changeVendor(vendor: ProviderVendor) {
    const selected = enabledProviders.find((managedProvider) => managedProvider.vendor === vendor);
    onChange({
      vendor,
      model: selected?.models[0] ?? ""
    });
  }

  return (
    <section className="providerModule">
      <div className="moduleHeader">
        <div>
          <p className="eyebrow">LLM Provider</p>
          <h2>大模型服务商</h2>
        </div>
        <div className="providerBadges">
          <span className={`moduleState ${readyForRemote ? "active" : ""}`}>
            {readyForRemote ? "远程调用" : "待管理员配置"}
          </span>
          <span className="moduleState active">剩余 {usageQuota.remainingRuns} 次</span>
        </div>
      </div>
      <div className="providerGrid">
        <label>
          AI 服务商
          <select
            value={selectedVendor}
            disabled={!enabledProviders.length}
            onChange={(event) => changeVendor(event.target.value as ProviderVendor)}
          >
            {enabledProviders.map((managedProvider) => (
              <option key={managedProvider.vendor} value={managedProvider.vendor}>
                {managedProvider.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          模型
          <select
            value={selectedModel}
            disabled={!selectedProvider?.models.length}
            onChange={(event) => onChange({ vendor: selectedVendor, model: event.target.value })}
          >
            {(selectedProvider?.models ?? []).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="fieldHint">
        用户端只选择可用服务商与模型；API Key 和兼容接口地址由管理员统一维护。远程调用计费：
        OpenAI 每次消耗 3 次，DeepSeek / 通义千问每次消耗 1 次。
      </p>
      <div className="quotaStrip">
        <span>{usageQuota.plan} 额度</span>
        <strong>{usageQuota.remainingRuns}</strong>
        <small>
          当前选择远程调用每次消耗 {selectedProviderCost} 次；已用 {usageQuota.usedRuns} / {usageQuota.totalRuns} 次，
          {usageQuota.note}
        </small>
      </div>
    </section>
  );
}

function AdminProviderModule({
  managedProviders,
  onChange
}: {
  managedProviders: ManagedProviderConfig[];
  onChange: (managedProviders: ManagedProviderConfig[]) => void;
}) {
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});

  function updateProvider(index: number, patch: Partial<ManagedProviderConfig>) {
    onChange(managedProviders.map((managedProvider, providerIndex) => (providerIndex === index ? { ...managedProvider, ...patch } : managedProvider)));
  }

  function saveApiKey(provider: ManagedProviderConfig) {
    const nextProviders = saveManagedProviderApiKey(managedProviders, provider.vendor, apiKeyDrafts[provider.vendor] ?? "");
    onChange(nextProviders);
    setApiKeyDrafts((current) => ({ ...current, [provider.vendor]: "" }));
  }

  function deleteApiKey(provider: ManagedProviderConfig) {
    onChange(deleteManagedProviderApiKey(managedProviders, provider.vendor));
    setApiKeyDrafts((current) => ({ ...current, [provider.vendor]: "" }));
  }

  return (
    <section className="panel adminProviderPanel">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>模型与 API 管理</h2>
        </div>
        <span className="moduleState active">管理员</span>
      </div>
      <p className="fieldHint">这里维护平台统一提供的模型服务。用户端不会看到 API Key，只会看到已启用服务商和模型。</p>
      <div className="adminProviderList">
        {managedProviders.map((managedProvider, index) => (
          <article key={managedProvider.vendor} className="adminProviderCard">
            <div className="sectionHeader">
              <h3>{managedProvider.label}</h3>
              <label className="inlineToggle">
                <input
                  type="checkbox"
                  checked={managedProvider.enabled}
                  onChange={(event) => updateProvider(index, { enabled: event.target.checked })}
                />
                启用
              </label>
            </div>
            <div className="adminProviderGrid">
              <label>
                服务商名称
                <input value={managedProvider.label} onChange={(event) => updateProvider(index, { label: event.target.value })} />
              </label>
              <label>
                兼容接口地址
                <input
                  placeholder="https://api.example.com/v1"
                  value={managedProvider.baseUrl}
                  onChange={(event) => updateProvider(index, { baseUrl: event.target.value })}
                />
              </label>
              <label>
                API Key
                <input
                  type="password"
                  placeholder="由管理员配置"
                  value={managedProvider.apiKey}
                  onChange={(event) => updateProvider(index, { apiKey: event.target.value })}
                />
              </label>
              <label>
                模型列表
                <input
                  placeholder="多个模型用英文逗号分隔"
                  value={managedProvider.models.join(", ")}
                  onChange={(event) =>
                    updateProvider(index, {
                      models: event.target.value
                        .split(",")
                        .map((model) => model.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </label>
            </div>
            <label className="adminApiKeyControl">
              API Key
              <div className="apiKeyControl">
                <input
                  type="password"
                  placeholder={managedProvider.apiKey ? "API Key 已保存，删除后可重新添加" : "输入 API Key 后点击保存"}
                  value={managedProvider.apiKey ? "••••••••••••" : apiKeyDrafts[managedProvider.vendor] ?? ""}
                  disabled={Boolean(managedProvider.apiKey)}
                  onChange={(event) =>
                    setApiKeyDrafts((current) => ({
                      ...current,
                      [managedProvider.vendor]: event.target.value
                    }))
                  }
                />
                {managedProvider.apiKey ? (
                  <button className="ghostButton dangerButton" type="button" onClick={() => deleteApiKey(managedProvider)}>
                    删除
                  </button>
                ) : (
                  <button
                    className="ghostButton"
                    type="button"
                    onClick={() => saveApiKey(managedProvider)}
                    disabled={!apiKeyDrafts[managedProvider.vendor]?.trim()}
                  >
                    保存
                  </button>
                )}
              </div>
              <small className="secretHint">
                API Key 仅保存在本机浏览器 localStorage，不会写入源码或提交到 GitHub。
              </small>
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}

function PricingPage({
  provider,
  managedProviders,
  usageQuota,
  onProviderChange
}: {
  provider: ProviderConfig;
  managedProviders: ManagedProviderConfig[];
  usageQuota: UsageQuota;
  onProviderChange: (provider: ProviderConfig) => void;
}) {
  const packs = [
    { name: "轻量包", runs: "50 次", price: "¥29", note: "适合短篇试改和小规模验证" },
    { name: "创作包", runs: "200 次", price: "¥99", note: "适合连续章节和多版本改写" },
    { name: "工作室包", runs: "1000 次", price: "¥399", note: "适合团队项目和批量剧本生产" }
  ];

  const comparison = [
    ["基础章节解析", "支持", "支持"],
    ["结构化 YAML 输出", "支持", "支持"],
    ["Schema 校验", "支持", "支持"],
    ["真实 LLM 调用", "使用次数包", "使用次数包，优先队列"],
    ["单次可处理章节", "最多 3 章", "建议 30 章以内"],
    ["场景重新生成", "不支持", "支持"],
    ["Markdown 剧本导出", "支持", "支持"],
    ["团队协作与历史版本", "不支持", "规划中优先开放"]
  ];

  return (
    <div className="pricingPage">
      <ProviderModule
        provider={provider}
        managedProviders={managedProviders}
        usageQuota={usageQuota}
        onChange={onProviderChange}
      />

      <section className="pricingHero">
        <div>
          <p className="eyebrow">会员服务</p>
          <h2>按生成次数付费，先验证再扩展</h2>
          <p>
            ScriptForge 的计费围绕真实 AI 生成消耗设计。免费版用于验证流程，Pro 版面向持续改编和团队生产，
            生成次数按包购买，用完再续。
          </p>
        </div>
        <div className="pricingMetric">
          <span>计费单位</span>
          <strong>1 次生成</strong>
          <p>完成一次章节理解、故事建模、场景拆分或剧本生成请求。</p>
        </div>
      </section>

      <section className="planGrid">
        <article className="planCard">
          <div className="planIcon">
            <Sparkles size={20} />
          </div>
          <p className="planKicker">Free</p>
          <h3>免费版</h3>
          <div className="planPrice">¥0</div>
          <p className="planCopy">适合体验产品能力、验证小说改编链路和展示 Schema 结构。</p>
          <ul>
            <li>本地 mock 流水线不限次</li>
            <li>真实 LLM 赠送 10 次生成额度</li>
            <li>最多 3 章小说试改</li>
            <li>YAML 校验、复制和下载</li>
          </ul>
          <button className="ghostButton">当前可用</button>
        </article>

        <article className="planCard featuredPlan">
          <div className="planIcon">
            <Gauge size={20} />
          </div>
          <p className="planKicker">Pro</p>
          <h3>Pro 版</h3>
          <div className="planPrice">¥79 起</div>
          <p className="planCopy">适合长篇小说、多版本剧本初稿、工作室批量改编和商业项目交付。</p>
          <ul>
            <li>200 次生成</li>
            <li>支持 OpenAI、DeepSeek、通义等模型</li>
            <li>更长章节处理与优先队列</li>
            <li>支持单场景重生成和高级导出</li>
          </ul>
          <button className="primaryButton">
            <CreditCard size={18} />
            购买次数包
          </button>
        </article>
      </section>

      <section className="usagePricing panel">
        <div className="sectionHeader">
          <h2>生成次数包</h2>
          <span className="pricingNote">次数不过期，团队额度共享可作为后续 Pro 能力开放</span>
        </div>
        <div className="packGrid">
          {packs.map((pack) => (
            <article key={pack.name} className="packCard">
              <span>{pack.name}</span>
              <strong>{pack.price}</strong>
              <p>{pack.runs}生成</p>
              <small>{pack.note}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="comparisonPanel panel">
        <div className="sectionHeader">
          <h2>套餐对比</h2>
          <ShieldCheck size={18} />
        </div>
        <div className="comparisonTable">
          <div className="tableHead">能力</div>
          <div className="tableHead">免费版</div>
          <div className="tableHead">Pro 版</div>
          {comparison.map(([feature, free, pro]) => (
            <div className="tableRow" key={feature}>
              <span>{feature}</span>
              <span>{free}</span>
              <span>{pro}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pricingFaq">
        {[
          ["为什么按生成次数收费？", "小说改编会拆成多个 AI 阶段，按次数计费比按月订阅更贴近实际成本，也方便作者按项目预算控制支出。"],
          ["本地 mock 会扣次数吗？", "不会。本地 mock 用于演示流程和调试结构，不调用外部 LLM，也不计入生成次数。"],
          ["一次完整改编会消耗几次？", "取决于章节数量和场景数量。系统会先解析章节，再按场景生成剧本，因此长篇项目会消耗更多次数。"]
        ].map(([question, answer]) => (
          <article key={question}>
            <h3>{question}</h3>
            <p>{answer}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>("workflow");
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [sessionAccountId, setSessionAccountId] = useState("");
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("admin123");
  const [loginError, setLoginError] = useState("");
  const [accountDraft, setAccountDraft] = useState<AccountDraft>(emptyAccountDraft);
  const [editingAccountId, setEditingAccountId] = useState("");
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStepId>("input");
  const [inputSaved, setInputSaved] = useState(false);
  const [chaptersSaved, setChaptersSaved] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);
  const [savedWorkflowStep, setSavedWorkflowStep] = useState<WorkflowDisplayStepId | "">("");
  const [title, setTitle] = useState("雨夜旧案");
  const [author, setAuthor] = useState("原作者");
  const [text, setText] = useState(sampleText);
  const [provider, setProvider] = useState<ProviderConfig>({
    vendor: defaultManagedProviders[0].vendor,
    model: defaultManagedProviders[0].models[0]
  });
  const [managedProviders, setManagedProviders] = useState<ManagedProviderConfig[]>(defaultManagedProviders);
  const [managedProvidersLoaded, setManagedProvidersLoaded] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [manualChapters, setManualChapters] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [yaml, setYaml] = useState("");
  const [resultSubView, setResultSubView] = useState<ResultSubView>("overview");
  const [revisionTarget, setRevisionTarget] = useState("");
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [confirmedChapterIds, setConfirmedChapterIds] = useState<string[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("准备就绪");
  const [error, setError] = useState("");
  const [yamlVersions, setYamlVersions] = useState<SavedYamlVersion[]>([]);
  const [yamlVersionsLoaded, setYamlVersionsLoaded] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [versionDraft, setVersionDraft] = useState("");
  const [pendingResultUsageCost, setPendingResultUsageCost] = useState(0);
  const currentAccount = useMemo(
    () => accounts.find((account) => account.id === sessionAccountId) ?? null,
    [accounts, sessionAccountId]
  );
  const usageQuota = getUsageQuota(currentAccount?.quota);
  const workflowProviderSelection = useMemo(
    () => getProviderSelection(provider, managedProviders),
    [provider, managedProviders]
  );
  const isAdmin = canManageUsers(currentAccount);

  useEffect(() => {
    const storedAccounts = parseAccounts(window.localStorage.getItem(ACCOUNTS_STORAGE_KEY));
    setAccounts(storedAccounts);
    setSessionAccountId(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? "");
    setAccountsLoaded(true);
  }, []);

  useEffect(() => {
    if (!accountsLoaded) return;
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, serializeAccounts(accounts));
  }, [accounts, accountsLoaded]);

  useEffect(() => {
    if (!accountsLoaded) return;
    if (sessionAccountId) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, sessionAccountId);
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [accountsLoaded, sessionAccountId]);

  useEffect(() => {
    if (!currentAccount && sessionAccountId) {
      setSessionAccountId("");
    }
  }, [currentAccount, sessionAccountId]);

  useEffect(() => {
    setYamlVersions(parseYamlVersions(window.localStorage.getItem(YAML_HISTORY_STORAGE_KEY)));
    setYamlVersionsLoaded(true);
  }, []);

  useEffect(() => {
    setManagedProviders(parseManagedProviders(window.localStorage.getItem(MANAGED_PROVIDERS_STORAGE_KEY)));
    setManagedProvidersLoaded(true);
  }, []);

  useEffect(() => {
    if (!yamlVersionsLoaded) return;
    window.localStorage.setItem(YAML_HISTORY_STORAGE_KEY, serializeYamlVersions(yamlVersions));
  }, [yamlVersions, yamlVersionsLoaded]);

  useEffect(() => {
    if (!managedProvidersLoaded) return;
    window.localStorage.setItem(MANAGED_PROVIDERS_STORAGE_KEY, serializeManagedProviders(managedProviders));
  }, [managedProviders, managedProvidersLoaded]);

  const activeWorkflowStep = workflowStep === "result" && resultSubView !== "overview" ? resultSubView : workflowStep;
  const currentWorkflowSteps = useMemo(
    () =>
      getCurrentWorkflowSteps({
        started: workflowStarted,
        inputSaved,
        chaptersSaved,
        hasResult: Boolean(result),
        activeStep: activeWorkflowStep
      }),
    [activeWorkflowStep, chaptersSaved, inputSaved, result, workflowStarted]
  );

  const completion = useMemo(() => {
    if (resultSaved) return 100;
    if (result) return 90;
    if (chapters.length > 0 && workflowStarted) return 66;
    if (workflowStarted && text.trim()) return 33;
    return 8;
  }, [chapters.length, result, resultSaved, text, workflowStarted]);

  const chapterReviewItems = useMemo(
    () => (result ? buildChapterReviewItems(result.script, result.chapters) : []),
    [result]
  );

  const revisionTargets = useMemo(() => {
    const script = result?.script;
    if (!script) return [];
    return [
      ...script.scenes.map((scene) => ({
        value: `scene:${scene.id}`,
        label: `场景 · ${scene.title}`
      })),
      ...(script.storyboard?.shots ?? []).map((shot) => ({
        value: `shot:${shot.id}`,
        label: `镜头 · ${shot.id}`
      })),
      ...(script.video_prompts ?? []).map((prompt) => ({
        value: `prompt:${prompt.id}`,
        label: `Prompt · ${prompt.id}`
      })),
      ...(script.video_tasks ?? []).map((task) => ({
        value: `video_task:${task.id}`,
        label: `视频任务 · ${task.id}`
      }))
    ];
  }, [result?.script]);

  const selectedVersion = useMemo(
    () => yamlVersions.find((version) => version.id === selectedVersionId) ?? yamlVersions[0] ?? null,
    [selectedVersionId, yamlVersions]
  );

  const accountUsageRecords = useMemo(
    () =>
      accounts
        .flatMap((account) =>
          account.usageRecords.map((record) => ({
            ...record,
            username: account.username
          }))
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [accounts]
  );

  useEffect(() => {
    if (!selectedVersion) {
      setSelectedVersionId("");
      setVersionDraft("");
      return;
    }

    setSelectedVersionId(selectedVersion.id);
    setVersionDraft(selectedVersion.yaml);
  }, [selectedVersion]);

  const allChaptersConfirmed =
    chapterReviewItems.length > 0 && chapterReviewItems.every((item) => confirmedChapterIds.includes(item.chapter.id));
  const canAdvanceCurrentWorkflowStep = canAdvanceWorkflowStep({
    activeStep: activeWorkflowStep,
    inputSaved,
    chaptersSaved,
    hasYaml: Boolean(yaml),
    allChaptersConfirmed,
    resultSaved,
    savedStep: savedWorkflowStep
  });

  function login() {
    const account = authenticateAccount(accounts, loginUsername, loginPassword);
    if (!account) {
      setLoginError("用户名、密码错误，或账户已停用");
      return;
    }

    setLoginError("");
    setSessionAccountId(account.id);
    setActiveView("workflow");
    setStatus(`${account.role === "admin" ? "管理员" : "用户"} ${account.username} 已登录`);
  }

  function logout() {
    setSessionAccountId("");
    setActiveView("workflow");
    setStatus("已退出登录");
  }

  function resetAccountForm() {
    setEditingAccountId("");
    setAccountDraft(emptyAccountDraft);
  }

  function saveAccount() {
    if (!isAdmin) return;
    if (editingAccountId) {
      setAccounts((current) => updateAccount(current, editingAccountId, accountDraft));
      setStatus(`用户 ${accountDraft.username} 已更新`);
    } else {
      setAccounts((current) => createAccount(current, accountDraft));
      setStatus(`用户 ${accountDraft.username} 已创建`);
    }
    resetAccountForm();
  }

  function editAccount(account: Account) {
    setEditingAccountId(account.id);
    setAccountDraft({
      username: account.username,
      password: account.password,
      role: account.role,
      status: account.status
    });
  }

  function removeAccount(account: Account) {
    if (!isAdmin) return;
    setAccounts((current) => deleteAccount(current, account.id));
    if (sessionAccountId === account.id) {
      setSessionAccountId("");
    }
    setStatus(`用户 ${account.username} 已删除`);
  }

  function applyParsedChapters(parsed: Chapter[], nextStep: WorkflowStepId = "chapters") {
    setWorkflowStarted(true);
    setChapters(parsed);
    setChaptersSaved(false);
    setResult(null);
    setYaml("");
    setResultSaved(false);
    setSavedWorkflowStep("");
    setConfirmedChapterIds([]);
    setIssues([]);
    setIsValid(false);
    setManualChapters(
      parsed
        .map((chapter) => `${chapter.title}\n${chapter.text}`)
        .join("\n\n---\n\n")
    );
    setWorkflowStep(nextStep);
    setStatus(parsed.length >= 3 ? `已识别 ${parsed.length} 个章节` : "章节少于 3 个，仍可演示生成");
  }

  async function saveProjectInput() {
    if (!title.trim() || !text.trim()) {
      setStatus("请先填写小说标题和正文");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("正在调用大模型进行章节解析");
    try {
      const resolvedProvider = resolveProviderConfig(provider, managedProviders);
      const response = await fetch("/api/chapters/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          provider: resolvedProvider
        })
      });
      const payload = (await response.json()) as {
        chapters?: Chapter[];
        source?: "local" | "remote" | "local_fallback";
        fallbackReason?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "章节解析失败");

      setInputSaved(true);
      setResultSaved(false);
      setSavedWorkflowStep("");
      applyParsedChapters(payload.chapters ?? [], "input");
      if (payload.source === "local_fallback") {
        setStatus(`远程章节解析失败，已使用本地规则保存。${payload.fallbackReason ? `原因：${payload.fallbackReason}` : ""}`);
      } else if (payload.source === "local") {
        setStatus("已使用本地规则保存章节解析结果");
      } else {
        setStatus("已使用大模型保存章节解析结果");
      }
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "章节解析失败");
      setStatus("章节解析失败");
    } finally {
      setLoading(false);
    }
  }

  function applyManualChapters() {
    const parsed = chaptersFromManualText(manualChapters);
    setChapters(parsed);
    setChaptersSaved(true);
    setResultSaved(false);
    setSavedWorkflowStep("");
    setStatus(`章节解析已保存，共 ${parsed.length} 个章节`);
  }

  function syncScript(nextScript: ScriptYaml, statusText: string) {
    const validation = validateScriptYaml(nextScript);
    const nextYaml = toYaml(nextScript);
    setResult((current) =>
      current
        ? {
            ...current,
            script: nextScript,
            yaml: nextYaml,
            validation: {
              valid: validation.valid,
              issues: validation.issues
            }
          }
        : current
    );
    setYaml(nextYaml);
    setIssues(validation.issues);
    setIsValid(validation.valid);
    setResultSaved(false);
    setSavedWorkflowStep("");
    setStatus(statusText);
  }

  function applyScriptPayload(
    payload: { script: ScriptYaml; yaml: string; validation: { valid: boolean; issues: ValidationIssue[] } },
    statusText: string
  ) {
    setResult((current) =>
      current
        ? {
            ...current,
            script: payload.script,
            yaml: payload.yaml,
            validation: payload.validation
          }
        : current
    );
    setYaml(payload.yaml);
    setIssues(payload.validation.issues);
    setIsValid(payload.validation.valid);
    setResultSaved(false);
    setSavedWorkflowStep("");
    setStatus(statusText);
  }

  async function runYamlAction(path: string, body: Record<string, unknown>, statusText: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "操作失败");
      applyScriptPayload(payload, statusText);
      return payload;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败");
      setStatus("操作失败");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function generateStoryboardAction() {
    await runYamlAction("/api/storyboard/generate", { yaml }, "分镜 YAML 已生成并回写");
    setResultSubView("storyboard");
  }

  async function generateVideoPromptsAction() {
    await runYamlAction("/api/video-prompts/generate", { yaml }, "视频 Prompt 已生成并回写");
    setResultSubView("prompts");
  }

  async function submitVideoTasksAction() {
    await runYamlAction("/api/video/tasks", { yaml }, "mock 视频任务已提交并写回 YAML");
    setResultSubView("video");
  }

  async function applyRevisionAction() {
    const target = parseRevisionTarget(revisionTarget || revisionTargets[0]?.value || "");
    if (!target || !revisionFeedback.trim()) {
      setStatus("请先选择反馈目标并填写反馈内容");
      return;
    }

    const payload = await runYamlAction(
      "/api/revisions/apply",
      {
        yaml,
        scope: target,
        feedback: revisionFeedback
      },
      "反馈已局部回写到 YAML"
    );
    if (payload) setRevisionFeedback("");
  }

  async function refreshVideoTask(taskId: string) {
    if (!result) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/video/tasks/${taskId}`);
      const payload = (await response.json()) as { task?: VideoTask; error?: string };
      if (!response.ok || !payload.task) throw new Error(payload.error || "任务查询失败");
      syncScript(
        {
          ...result.script,
          video_tasks: (result.script.video_tasks ?? []).map((task) => (task.id === taskId ? payload.task! : task))
        },
        `视频任务 ${taskId} 已刷新`
      );
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "任务查询失败");
      setStatus("任务查询失败");
    } finally {
      setLoading(false);
    }
  }

  function openWorkflowStep(stepId: WorkflowDisplayStepId, available: boolean) {
    if (!available) return;
    openWorkflowDisplayStep(stepId);
  }

  function openWorkflowDisplayStep(stepId: WorkflowDisplayStepId) {
    if (stepId === "input" || stepId === "chapters" || stepId === "result") {
      setWorkflowStep(stepId);
      if (stepId === "result") setResultSubView("overview");
      return;
    }

    setWorkflowStep("result");
    setResultSubView(stepId);
  }

  function moveWorkflowStep(direction: 1 | -1) {
    const currentIndex = workflowDisplayOrder.indexOf(activeWorkflowStep);
    const nextStep = workflowDisplayOrder[currentIndex + direction];
    if (!nextStep) return;
    openWorkflowDisplayStep(nextStep);
  }

  function saveResult() {
    if (!yaml || !allChaptersConfirmed) return;

    const version = createYamlVersion({
      yaml,
      projectTitle: title,
      valid: isValid,
      issueCount: issues.length
    });

    setYamlVersions((current) => addYamlVersion(current, version));
    setSelectedVersionId(version.id);
    setVersionDraft(version.yaml);
    if (currentAccount && !resultSaved) {
      setAccounts((current) =>
        recordAccountUsage(current, currentAccount.id, getMergedYamlSaveUsage(pendingResultUsageCost))
      );
    }
    setResultSaved(true);
    setSavedWorkflowStep(activeWorkflowStep);
    setStatus(`改编结果已保存为 ${formatVersionTime(version.createdAt)} 的版本`);
  }

  function restoreYamlVersion(version: SavedYamlVersion) {
    setYaml(version.yaml);
    setIsValid(version.valid);
    setIssues([]);
    setActiveView("workflow");
    setWorkflowStarted(true);
    setWorkflowStep("result");
    setResultSaved(true);
    setSavedWorkflowStep("result");
    setStatus(`已回溯到 ${formatVersionTime(version.createdAt)} 的 YAML 版本`);
  }

  function selectYamlVersion(version: SavedYamlVersion) {
    setSelectedVersionId(version.id);
    setVersionDraft(version.yaml);
  }

  function saveVersionEdit() {
    if (!selectedVersion) return;

    setYamlVersions((current) => updateYamlVersionContent(current, selectedVersion.id, versionDraft));
    setStatus(`已保存 ${formatVersionTime(selectedVersion.createdAt)} 的版本编辑`);
  }

  function deleteVersion(version: SavedYamlVersion) {
    setYamlVersions((current) => deleteYamlVersion(current, version.id));
    if (selectedVersionId === version.id) {
      const nextVersion = yamlVersions.find((item) => item.id !== version.id);
      setSelectedVersionId(nextVersion?.id ?? "");
      setVersionDraft(nextVersion?.yaml ?? "");
    }
    setStatus(`已删除 ${formatVersionTime(version.createdAt)} 的版本`);
  }

  function confirmChapterMerge(chapterId: string) {
    setConfirmedChapterIds((current) => {
      if (current.includes(chapterId)) return current;
      const next = [...current, chapterId];
      setStatus(next.length === chapterReviewItems.length ? "章节 YAML 已全部确认，可以保存合并结果" : "章节 YAML 已确认");
      return next;
    });
  }

  async function runGeneration() {
    setLoading(true);
    setError("");
    setStatus("正在执行章节理解、故事建模和场景生成");
    try {
      const resolvedProvider = resolveProviderConfig(provider, managedProviders);
      const response = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          text,
          chapters,
          provider: resolvedProvider
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "生成失败");
      setResult(payload);
      setYaml(payload.yaml);
      setConfirmedChapterIds([]);
      setIssues(payload.validation.issues);
      setIsValid(payload.validation.valid);
      setResultSaved(false);
      setSavedWorkflowStep("");
      setPendingResultUsageCost(
        resolvedProvider.apiKey && resolvedProvider.model ? getProviderUsageCost(resolvedProvider) : 0
      );
      setWorkflowStep("result");
      setResultSubView("overview");
      setStatus(payload.validation.valid ? "生成完成，YAML 已通过校验" : "生成完成，但需要修复校验问题");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "生成失败");
      setStatus("生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function validateYaml() {
    setLoading(true);
    setStatus("正在校验 YAML");
    try {
      const response = await fetch("/api/yaml/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml })
      });
      const payload = await response.json();
      setIssues(payload.issues);
      setIsValid(payload.valid);
      if (payload.data) {
        setResult((current) =>
          current
            ? {
                ...current,
                script: payload.data,
                yaml,
                validation: {
                  valid: payload.valid,
                  issues: payload.issues
                }
              }
            : current
        );
      }
      setStatus(payload.valid ? "YAML 校验通过" : "YAML 存在待处理问题");
    } finally {
      setLoading(false);
    }
  }

  async function fixYaml() {
    setLoading(true);
    setStatus("正在修复 YAML 结构");
    try {
      const response = await fetch("/api/yaml/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "修复失败");
      setYaml(payload.yaml);
      setIssues(payload.validation.issues);
      setIsValid(payload.validation.valid);
      if (payload.validation.data) {
        setResult((current) =>
          current
            ? {
                ...current,
                script: payload.validation.data,
                yaml: payload.yaml,
                validation: {
                  valid: payload.validation.valid,
                  issues: payload.validation.issues
                }
              }
            : current
        );
      }
      setStatus(payload.validation.valid ? "修复完成，YAML 已通过校验" : "修复完成，仍有问题需要手动处理");
    } catch (fixError) {
      setError(fixError instanceof Error ? fixError.message : "修复失败");
      setStatus("修复失败");
    } finally {
      setLoading(false);
    }
  }

  async function copyYaml() {
    await navigator.clipboard.writeText(yaml);
    setStatus("YAML 已复制");
  }

  async function handleFile(file?: File) {
    if (!file) return;
    const content = await file.text();
    setText(content);
    setInputSaved(false);
    setSavedWorkflowStep("");
    setStatus(`已读取文件：${file.name}`);
  }

  function renderResultWorkflowContent() {
    if (workflowStep !== "result" || !result?.script) return null;
    const script = result.script;

    if (resultSubView === "overview") {
      return (
        <div className="workflowStepContent">
          <p className="fieldHint">
            改编结果已生成。确认章节 YAML 后可保存结果，也可以点击下一步进入剧本编辑、分镜、视频任务、Prompt、反馈回写和 YAML。
          </p>
        </div>
      );
    }

    if (resultSubView === "script") {
      return (
        <div className="workflowStepContent visualEditor">
          <div className="fieldGrid">
            <label>
              标题
              <input
                value={script.metadata.title}
                onChange={(event) =>
                  syncScript(
                    {
                      ...script,
                      metadata: { ...script.metadata, title: event.target.value }
                    },
                    "标题已同步到 YAML"
                  )
                }
              />
            </label>
            <label>
              作者
              <input
                value={script.metadata.author}
                onChange={(event) =>
                  syncScript(
                    {
                      ...script,
                      metadata: { ...script.metadata, author: event.target.value }
                    },
                    "作者已同步到 YAML"
                  )
                }
              />
            </label>
            <label>
              风格
              <input
                value={script.metadata.style ?? ""}
                onChange={(event) =>
                  syncScript(
                    {
                      ...script,
                      metadata: { ...script.metadata, style: event.target.value }
                    },
                    "风格已同步到 YAML"
                  )
                }
              />
            </label>
          </div>
          <div className="sceneEditorList">
            {script.scenes.map((scene, sceneIndex) => (
              <article className="sceneEditorCard" key={scene.id}>
                <div className="sectionHeader">
                  <h3>{scene.title}</h3>
                  <span className="moduleState">{scene.id}</span>
                </div>
                <div className="fieldGrid">
                  <label>
                    场景标题
                    <input
                      value={scene.title}
                      onChange={(event) =>
                        syncScript(
                          {
                            ...script,
                            scenes: script.scenes.map((item) =>
                              item.id === scene.id ? { ...item, title: event.target.value } : item
                            )
                          },
                          "场景标题已同步到 YAML"
                        )
                      }
                    />
                  </label>
                  <label>
                    场景功能
                    <input
                      value={scene.purpose}
                      onChange={(event) =>
                        syncScript(
                          {
                            ...script,
                            scenes: script.scenes.map((item) =>
                              item.id === scene.id ? { ...item, purpose: event.target.value } : item
                            )
                          },
                          "场景功能已同步到 YAML"
                        )
                      }
                    />
                  </label>
                  <label>
                    氛围
                    <input
                      value={scene.setting.atmosphere}
                      onChange={(event) =>
                        syncScript(
                          {
                            ...script,
                            scenes: script.scenes.map((item) =>
                              item.id === scene.id
                                ? {
                                    ...item,
                                    setting: { ...item.setting, atmosphere: event.target.value }
                                  }
                                : item
                            )
                          },
                          "场景氛围已同步到 YAML"
                        )
                      }
                    />
                  </label>
                </div>
                <div className="scriptLineList">
                  {scene.script.map((line, lineIndex) => (
                    <label key={`${scene.id}-${lineIndex}`}>
                      {scriptLineLabel(line)}
                      <textarea
                        value={line.content}
                        onChange={(event) => {
                          const nextScenes = script.scenes.map((item, index) =>
                            index === sceneIndex
                              ? {
                                  ...item,
                                  script: item.script.map((scriptLine, scriptIndex) =>
                                    scriptIndex === lineIndex ? { ...scriptLine, content: event.target.value } : scriptLine
                                  )
                                }
                              : item
                          );
                          syncScript({ ...script, scenes: nextScenes }, "剧本行已同步到 YAML");
                        }}
                      />
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      );
    }

    if (resultSubView === "storyboard") {
      return (
        <div className="workflowStepContent">
          <div className="toolbar stepToolbar">
            <button className="ghostButton" onClick={generateStoryboardAction} disabled={loading}>
              生成分镜
            </button>
          </div>
          <div className="cardGrid">
            {(script.storyboard?.shots ?? []).length ? (
              script.storyboard?.shots.map((shot) => (
                <article className="videoChainCard" key={shot.id}>
                  <div className="sectionHeader">
                    <h3>{shot.id}</h3>
                    <span className="moduleState active">{shot.duration_seconds}s</span>
                  </div>
                  <label>
                    镜头描述
                    <textarea
                      value={shot.description}
                      onChange={(event) =>
                        syncScript(
                          {
                            ...script,
                            storyboard: {
                              shots: script.storyboard!.shots.map((item) =>
                                item.id === shot.id ? { ...item, description: event.target.value } : item
                              )
                            }
                          },
                          "分镜描述已同步到 YAML"
                        )
                      }
                    />
                  </label>
                  <div className="fieldGrid">
                    <label>
                      景别
                      <input
                        value={shot.framing}
                        onChange={(event) =>
                          syncScript(
                            {
                              ...script,
                              storyboard: {
                                shots: script.storyboard!.shots.map((item) =>
                                  item.id === shot.id ? { ...item, framing: event.target.value } : item
                                )
                              }
                            },
                            "景别已同步到 YAML"
                          )
                        }
                      />
                    </label>
                    <label>
                      运动
                      <input
                        value={shot.movement}
                        onChange={(event) =>
                          syncScript(
                            {
                              ...script,
                              storyboard: {
                                shots: script.storyboard!.shots.map((item) =>
                                  item.id === shot.id ? { ...item, movement: event.target.value } : item
                                )
                              }
                            },
                            "镜头运动已同步到 YAML"
                          )
                        }
                      />
                    </label>
                    <label>
                      时长
                      <input
                        type="number"
                        min="1"
                        value={shot.duration_seconds}
                        onChange={(event) =>
                          syncScript(
                            {
                              ...script,
                              storyboard: {
                                shots: script.storyboard!.shots.map((item) =>
                                  item.id === shot.id ? { ...item, duration_seconds: Number(event.target.value) || 1 } : item
                                )
                              }
                            },
                            "镜头时长已同步到 YAML"
                          )
                        }
                      />
                    </label>
                  </div>
                </article>
              ))
            ) : (
              <div className="emptyState">还没有分镜。点击“生成分镜”从 scenes.script 生成镜头 YAML。</div>
            )}
          </div>
        </div>
      );
    }

    if (resultSubView === "video") {
      return (
        <div className="workflowStepContent">
          <div className="toolbar stepToolbar">
            <button className="primaryButton" onClick={submitVideoTasksAction} disabled={loading}>
              提交 mock 视频
            </button>
          </div>
          <div className="cardGrid">
            {(script.video_tasks ?? []).length ? (
              script.video_tasks?.map((task) => (
                <article className="videoChainCard" key={task.id}>
                  <div className="sectionHeader">
                    <h3>{task.id}</h3>
                    <span className={`moduleState ${task.status === "succeeded" ? "active" : ""}`}>{task.status}</span>
                  </div>
                  <p className="fieldHint">{task.prompt_id}</p>
                  {task.result_url ? (
                    <div className="videoPreviewBox">
                      <span>{task.result_url}</span>
                      <video controls src={task.result_url} />
                    </div>
                  ) : (
                    <p className="fieldHint">任务尚未产生结果 URL，刷新后 mock provider 会推进状态。</p>
                  )}
                  <button className="ghostButton" onClick={() => refreshVideoTask(task.id)} disabled={loading}>
                    刷新状态
                  </button>
                </article>
              ))
            ) : (
              <div className="emptyState">还没有视频任务。先生成 Prompt，再点击“提交 mock 视频”。</div>
            )}
          </div>
        </div>
      );
    }

    if (resultSubView === "prompts") {
      return (
        <div className="workflowStepContent">
          <div className="toolbar stepToolbar">
            <button className="ghostButton" onClick={generateVideoPromptsAction} disabled={loading}>
              生成 Prompt
            </button>
          </div>
          <div className="cardGrid">
            {(script.video_prompts ?? []).length ? (
              script.video_prompts?.map((prompt) => (
                <article className="videoChainCard" key={prompt.id}>
                  <div className="sectionHeader">
                    <h3>{prompt.id}</h3>
                    <span className="moduleState">{prompt.shot_id}</span>
                  </div>
                  <label>
                    Positive Prompt
                    <textarea
                      value={prompt.positive}
                      onChange={(event) =>
                        syncScript(
                          {
                            ...script,
                            video_prompts: script.video_prompts!.map((item) =>
                              item.id === prompt.id ? { ...item, positive: event.target.value } : item
                            )
                          },
                          "视频 Prompt 已同步到 YAML"
                        )
                      }
                    />
                  </label>
                  <label>
                    Negative Prompt
                    <textarea
                      value={prompt.negative}
                      onChange={(event) =>
                        syncScript(
                          {
                            ...script,
                            video_prompts: script.video_prompts!.map((item) =>
                              item.id === prompt.id ? { ...item, negative: event.target.value } : item
                            )
                          },
                          "负向 Prompt 已同步到 YAML"
                        )
                      }
                    />
                  </label>
                </article>
              ))
            ) : (
              <div className="emptyState">还没有视频 Prompt。点击“生成 Prompt”从分镜生成视频模型提示词。</div>
            )}
          </div>
        </div>
      );
    }

    if (resultSubView === "revision") {
      return (
        <div className="workflowStepContent revisionPanel">
          <label>
            反馈目标
            <select
              value={revisionTarget || revisionTargets[0]?.value || ""}
              onChange={(event) => setRevisionTarget(event.target.value)}
            >
              {revisionTargets.map((target) => (
                <option key={target.value} value={target.value}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            作者反馈
            <textarea
              value={revisionFeedback}
              onChange={(event) => setRevisionFeedback(event.target.value)}
              placeholder="例如：镜头更贴近窗外雨滴，人物暂时不要入画。"
            />
          </label>
          <button className="primaryButton" onClick={applyRevisionAction} disabled={loading || !revisionTargets.length}>
            回写反馈
          </button>
          <div className="revisionLogList">
            {(script.revision_log ?? []).map((revision) => (
              <article key={revision.id}>
                <strong>{revision.action}</strong>
                <span>
                  {revision.scope.type} · {revision.scope.id}
                </span>
                <p>{revision.feedback}</p>
              </article>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="workflowStepContent yamlPane mergedYamlPane">
        <div className="sectionHeader">
          <h2>合并后的剧本 YAML</h2>
          <div className="toolbar">
            <button className="iconButton" title="保存合并 YAML" onClick={saveResult} disabled={!yaml || !allChaptersConfirmed}>
              <Save size={18} />
            </button>
            <button className="iconButton" title="校验 YAML" onClick={validateYaml} disabled={loading}>
              <CheckCircle2 size={18} />
            </button>
            <button className="iconButton" title="修复 YAML" onClick={fixYaml} disabled={loading}>
              <RefreshCw size={18} />
            </button>
            <button className="iconButton" title="复制 YAML" onClick={copyYaml} disabled={!yaml}>
              <Clipboard size={18} />
            </button>
            <button
              className="iconButton"
              title="下载 YAML"
              onClick={() => downloadText("scriptforge.yaml", yaml, "application/yaml;charset=utf-8")}
              disabled={!yaml}
            >
              <Download size={18} />
            </button>
            <button
              className="iconButton"
              title="下载 Markdown 剧本"
              onClick={() => downloadText("scriptforge-script.md", result.markdown ?? "")}
              disabled={!result.markdown}
            >
              <FileText size={18} />
            </button>
          </div>
        </div>
        <textarea
          className="yamlEditor"
          value={yaml}
          onChange={(event) => {
            setYaml(event.target.value);
            setResultSaved(false);
            setSavedWorkflowStep("");
          }}
        />
        <div className={`validationBox ${isValid ? "ok" : ""}`}>
          <strong>{isValid ? "YAML 已通过 Schema 与引用校验" : "校验问题"}</strong>
          <IssueList issues={issues} />
        </div>
      </div>
    );
  }

  function renderWorkflowActions() {
    if (!workflowStarted) return null;

    if (workflowStep === "input") {
      return (
        <div className="workflowActions">
          <button className="ghostButton" onClick={saveProjectInput} disabled={loading}>
            {loading ? "解析中" : "保存"}
          </button>
          <button className="ghostButton" disabled>
            上一步
          </button>
          <button
            className="primaryButton"
            onClick={() => setWorkflowStep("chapters")}
            disabled={loading || !canAdvanceCurrentWorkflowStep}
          >
            下一步
          </button>
        </div>
      );
    }

    if (workflowStep === "chapters") {
      return (
        <div className="workflowActions">
          <button className="ghostButton" onClick={applyManualChapters}>
            保存
          </button>
          <button className="ghostButton" onClick={() => setWorkflowStep("input")}>
            上一步
          </button>
          <button className="primaryButton" onClick={runGeneration} disabled={!chaptersSaved || loading}>
            <Wand2 size={18} />
            {loading ? "生成中" : "下一步"}
          </button>
        </div>
      );
    }

    return (
      <div className="workflowActions">
        <button className="ghostButton" onClick={saveResult} disabled={!yaml || !allChaptersConfirmed}>
          保存
        </button>
        <button className="ghostButton" onClick={() => moveWorkflowStep(-1)}>
          上一步
        </button>
        <button className="primaryButton" onClick={() => moveWorkflowStep(1)} disabled={!canAdvanceCurrentWorkflowStep}>
          下一步
        </button>
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <main className="loginShell">
        <section className="loginPanel panel">
          <div className="loginBrand">
            <Wand2 size={32} />
            <div>
              <strong>ScriptForge</strong>
              <span>AI 改编流水线账户登录</span>
            </div>
          </div>
          <div>
            <p className="eyebrow">Account Access</p>
            <h1>登录后进入工作台</h1>
            <p>管理员可管理用户账户，普通用户只能进入改编工作流。</p>
          </div>
          <label>
            用户名
            <input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} />
          </label>
          <label>
            密码
            <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
          </label>
          {loginError ? <div className="errorBanner">{loginError}</div> : null}
          <button className="primaryButton" onClick={login}>
            登录
          </button>
          <div className="loginHints">
            <span>管理员：admin / admin123</span>
            <span>用户：user / user123</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <Wand2 size={28} />
            <div>
              <strong>ScriptForge</strong>
              <span>AI 改编流水线</span>
            </div>
          </div>
          <nav className="nav">
            {[
              ["schema", "Schema 文档"],
              ["workflow", "我的项目"],
              ["versions", "保存版本"],
              ...(isAdmin ? [["users", "用户管理"]] : []),
              ["pricing", "会员服务"]
            ].map(([id, label]) => (
              <button
                key={id}
                className={activeView === id ? "active" : ""}
                onClick={() => setActiveView(id as typeof activeView)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="accountCard">
            <div>
              <span>{currentAccount.role === "admin" ? "管理员" : "用户"}</span>
              <strong>{currentAccount.username}</strong>
            </div>
            <button className="iconButton" title="退出登录" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div className="pipelineStatus">
          <div className="progressLabel">
            <span>流水线进度</span>
            <strong>{completion}%</strong>
          </div>
          <div className="progressTrack">
            <span style={{ width: `${completion}%` }} />
          </div>
          <p>{status}</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">结构化 · 可校验 · 可编辑</p>
            <h1>小说到剧本 YAML 工作台</h1>
          </div>
          <div className={`statusBadge ${isValid ? "ok" : ""}`}>
            {isValid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {isValid ? "校验通过" : "等待校验"}
          </div>
        </header>

        {error ? <div className="errorBanner">{error}</div> : null}

        {activeView === "workflow" ? (
          <section className="panel workflowPanel">
            <div className="workflowLead">
              <div>
                <p className="eyebrow">改编流程</p>
                <h2>按当前步骤推进改编链路</h2>
                <p>这里一次只显示当前流程节点；剧本编辑、分镜、视频任务、Prompt、反馈回写和 YAML 都在本流程内完成。</p>
              </div>
              <div className="workflowLeadActions">
                <div
                  className="workflowModelInfo"
                  aria-label={`当前大模型 ${workflowProviderSelection.label} ${workflowProviderSelection.selectedModel || "未选择模型"}`}
                >
                  <span>当前大模型</span>
                  <strong>{workflowProviderSelection.label}</strong>
                  <small>{workflowProviderSelection.selectedModel || "未选择模型"}</small>
                  <button className="ghostButton" onClick={() => setActiveView("pricing")}>
                    在会员服务调整品牌和模型
                  </button>
                </div>
                <div className="workflowQuota" aria-label={`剩余 ${usageQuota.remainingRuns} 次生成`}>
                  <span>{usageQuota.plan} 额度</span>
                  <strong>剩余 {usageQuota.remainingRuns} 次</strong>
                  <small>{usageQuota.note}</small>
                </div>
                {!workflowStarted ? (
                  <button
                    className="primaryButton"
                    onClick={() => {
                      setWorkflowStarted(true);
                      setWorkflowStep("input");
                      setStatus("已开始，请完成项目输入");
                    }}
                  >
                    <Play size={18} />
                    开始
                  </button>
                ) : null}
              </div>
            </div>
            {workflowStarted ? (
              <div className="workflowSteps">
                {currentWorkflowSteps.map((step) => (
                  <button
                    key={step.id}
                    className={`workflowStep ${step.active ? "active" : ""} ${step.available ? "" : "locked"}`}
                    onClick={() => openWorkflowStep(step.id, step.available)}
                    disabled={!step.available}
                  >
                    <span>{step.order}</span>
                    <strong>{step.label}</strong>
                    <small>{step.description}</small>
                  </button>
                ))}
              </div>
            ) : null}
            {renderResultWorkflowContent()}
            {renderWorkflowActions()}
          </section>
        ) : null}

        {activeView === "workflow" && !workflowStarted ? (
          <section className="panel startPanel">
            <div>
              <h2>准备创建一个改编项目</h2>
              <p>开始后会先进入项目输入，完成小说文本和模型配置；随后解析章节，最后生成可校验、可导出的 YAML 改编结果。</p>
            </div>
          </section>
        ) : null}

        {activeView === "workflow" && workflowStarted && workflowStep === "input" ? (
          <div className="inputStack">
            <div className="panel inputGrid">
              <section className="formColumn">
                <label>
                  小说标题
                  <input
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setInputSaved(false);
                      setSavedWorkflowStep("");
                    }}
                  />
                </label>
                <label>
                  作者
                  <input
                    value={author}
                    onChange={(event) => {
                      setAuthor(event.target.value);
                      setInputSaved(false);
                      setSavedWorkflowStep("");
                    }}
                  />
                </label>
                <div className="buttonRow">
                  <label className="iconButton fileButton" title="上传 txt 或 md 文件">
                    <Upload size={18} />
                    <input
                      type="file"
                      accept=".txt,.md,text/plain,text/markdown"
                      onChange={(event) => handleFile(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </section>
              <section className="editorColumn">
                <label>
                  小说文本
                  <textarea
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value);
                      setInputSaved(false);
                      setSavedWorkflowStep("");
                    }}
                  />
                </label>
              </section>
            </div>
          </div>
        ) : null}

        {activeView === "workflow" && workflowStarted && workflowStep === "chapters" ? (
          <div className="chapterStepStack">
            <div className="panel chapterLayout">
            <section>
              <div className="sectionHeader">
                <h2>识别到的章节</h2>
              </div>
              <div className="chapterList">
                {chapters.map((chapter) => (
                  <details key={chapter.id} open>
                    <summary>
                      <span>{chapter.id}</span>
                      {chapter.title}
                    </summary>
                    <p>{chapter.text.slice(0, 360)}</p>
                  </details>
                ))}
              </div>
            </section>
            <section>
              <div className="sectionHeader">
                <h2>手动章节边界</h2>
              </div>
              <textarea
                className="manualEditor"
                value={manualChapters}
                onChange={(event) => {
                  setManualChapters(event.target.value);
                  setChaptersSaved(false);
                }}
                placeholder="每章之间使用单独一行 --- 分隔"
              />
            </section>
            </div>
          </div>
        ) : null}

        {activeView === "workflow" && workflowStarted && workflowStep === "result" && resultSubView === "overview" ? (
          <div className="resultStepStack">
            <section className="panel chapterReviewPanel">
              <div className="sectionHeader">
                <h2>章节理解与剧本 YAML 对照</h2>
                <FileText size={18} />
              </div>
              <div className="chapterReviewList">
                {chapterReviewItems.map((item) => {
                  const confirmed = confirmedChapterIds.includes(item.chapter.id);
                  return (
                    <article key={item.chapter.id} className={`chapterReviewCard ${confirmed ? "confirmed" : ""}`}>
                      <div className="chapterUnderstanding">
                        <div className="sectionHeader">
                          <h3>
                            <span>{item.chapter.id}</span>
                            {item.chapter.title}
                          </h3>
                          <span className={`moduleState ${confirmed ? "active" : ""}`}>
                            {confirmed ? "已确认" : "待确认"}
                          </span>
                        </div>
                        <p>{item.chapter.summary}</p>
                        <dl>
                          <dt>人物</dt>
                          <dd>{item.chapter.main_characters?.join("、") || "未识别"}</dd>
                          <dt>地点</dt>
                          <dd>{item.chapter.locations?.join("、") || "未识别"}</dd>
                          <dt>事件</dt>
                          <dd>{item.chapter.key_events?.join("；") || "未识别"}</dd>
                        </dl>
                      </div>
                      <div className="chapterYamlBlock">
                        <pre>{item.yaml}</pre>
                        <button className="ghostButton" onClick={() => confirmChapterMerge(item.chapter.id)} disabled={confirmed}>
                          {confirmed ? "已合并" : "确认并合并"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <StoryStructureSummary storyStructure={result?.script.story_structure} />

            {false ? (() => {
              const result = null as unknown as PipelineResult;
              return (
              <section className="panel videoChainPanel">
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Author Review & Video Chain</p>
                    <h2>作者可视化编辑与视频链路</h2>
                    <p>字段级编辑、分镜、视频 Prompt、mock 视频任务和反馈回写都会同步到同一份 YAML。</p>
                  </div>
                  <div className="toolbar">
                    <button className="ghostButton" onClick={generateStoryboardAction} disabled={loading}>
                      生成分镜
                    </button>
                    <button className="ghostButton" onClick={generateVideoPromptsAction} disabled={loading}>
                      生成 Prompt
                    </button>
                    <button className="primaryButton" onClick={submitVideoTasksAction} disabled={loading}>
                      提交 mock 视频
                    </button>
                  </div>
                </div>
                <div className="resultTabs">
                  {resultSubViews.map((view) => (
                    <button
                      key={view.id}
                      className={resultSubView === view.id ? "active" : ""}
                      onClick={() => setResultSubView(view.id)}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>

                {resultSubView === "script" ? (
                  <div className="visualEditor">
                    <div className="fieldGrid">
                      <label>
                        标题
                        <input
                          value={result.script.metadata.title}
                          onChange={(event) =>
                            syncScript(
                              {
                                ...result.script,
                                metadata: { ...result.script.metadata, title: event.target.value }
                              },
                              "标题已同步到 YAML"
                            )
                          }
                        />
                      </label>
                      <label>
                        作者
                        <input
                          value={result.script.metadata.author}
                          onChange={(event) =>
                            syncScript(
                              {
                                ...result.script,
                                metadata: { ...result.script.metadata, author: event.target.value }
                              },
                              "作者已同步到 YAML"
                            )
                          }
                        />
                      </label>
                      <label>
                        风格
                        <input
                          value={result.script.metadata.style ?? ""}
                          onChange={(event) =>
                            syncScript(
                              {
                                ...result.script,
                                metadata: { ...result.script.metadata, style: event.target.value }
                              },
                              "风格已同步到 YAML"
                            )
                          }
                        />
                      </label>
                    </div>
                    <div className="sceneEditorList">
                      {result.script.scenes.map((scene, sceneIndex) => (
                        <article className="sceneEditorCard" key={scene.id}>
                          <div className="sectionHeader">
                            <h3>{scene.title}</h3>
                            <span className="moduleState">{scene.id}</span>
                          </div>
                          <div className="fieldGrid">
                            <label>
                              场景标题
                              <input
                                value={scene.title}
                                onChange={(event) =>
                                  syncScript(
                                    {
                                      ...result.script,
                                      scenes: result.script.scenes.map((item) =>
                                        item.id === scene.id ? { ...item, title: event.target.value } : item
                                      )
                                    },
                                    "场景标题已同步到 YAML"
                                  )
                                }
                              />
                            </label>
                            <label>
                              场景功能
                              <input
                                value={scene.purpose}
                                onChange={(event) =>
                                  syncScript(
                                    {
                                      ...result.script,
                                      scenes: result.script.scenes.map((item) =>
                                        item.id === scene.id ? { ...item, purpose: event.target.value } : item
                                      )
                                    },
                                    "场景功能已同步到 YAML"
                                  )
                                }
                              />
                            </label>
                            <label>
                              氛围
                              <input
                                value={scene.setting.atmosphere}
                                onChange={(event) =>
                                  syncScript(
                                    {
                                      ...result.script,
                                      scenes: result.script.scenes.map((item) =>
                                        item.id === scene.id
                                          ? {
                                              ...item,
                                              setting: { ...item.setting, atmosphere: event.target.value }
                                            }
                                          : item
                                      )
                                    },
                                    "场景氛围已同步到 YAML"
                                  )
                                }
                              />
                            </label>
                          </div>
                          <div className="scriptLineList">
                            {scene.script.map((line, lineIndex) => (
                              <label key={`${scene.id}-${lineIndex}`}>
                                {scriptLineLabel(line)}
                                <textarea
                                  value={line.content}
                                  onChange={(event) => {
                                    const nextScenes = result.script.scenes.map((item, index) =>
                                      index === sceneIndex
                                        ? {
                                            ...item,
                                            script: item.script.map((scriptLine, scriptIndex) =>
                                              scriptIndex === lineIndex
                                                ? { ...scriptLine, content: event.target.value }
                                                : scriptLine
                                            )
                                          }
                                        : item
                                    );
                                    syncScript({ ...result.script, scenes: nextScenes }, "剧本行已同步到 YAML");
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {resultSubView === "storyboard" ? (
                  <div className="cardGrid">
                    {(result.script.storyboard?.shots ?? []).length ? (
                      result.script.storyboard?.shots.map((shot) => (
                        <article className="videoChainCard" key={shot.id}>
                          <div className="sectionHeader">
                            <h3>{shot.id}</h3>
                            <span className="moduleState active">{shot.duration_seconds}s</span>
                          </div>
                          <label>
                            镜头描述
                            <textarea
                              value={shot.description}
                              onChange={(event) =>
                                syncScript(
                                  {
                                    ...result.script,
                                    storyboard: {
                                      shots: result.script.storyboard!.shots.map((item) =>
                                        item.id === shot.id ? { ...item, description: event.target.value } : item
                                      )
                                    }
                                  },
                                  "分镜描述已同步到 YAML"
                                )
                              }
                            />
                          </label>
                          <div className="fieldGrid">
                            <label>
                              景别
                              <input
                                value={shot.framing}
                                onChange={(event) =>
                                  syncScript(
                                    {
                                      ...result.script,
                                      storyboard: {
                                        shots: result.script.storyboard!.shots.map((item) =>
                                          item.id === shot.id ? { ...item, framing: event.target.value } : item
                                        )
                                      }
                                    },
                                    "景别已同步到 YAML"
                                  )
                                }
                              />
                            </label>
                            <label>
                              运动
                              <input
                                value={shot.movement}
                                onChange={(event) =>
                                  syncScript(
                                    {
                                      ...result.script,
                                      storyboard: {
                                        shots: result.script.storyboard!.shots.map((item) =>
                                          item.id === shot.id ? { ...item, movement: event.target.value } : item
                                        )
                                      }
                                    },
                                    "镜头运动已同步到 YAML"
                                  )
                                }
                              />
                            </label>
                            <label>
                              时长
                              <input
                                type="number"
                                min="1"
                                value={shot.duration_seconds}
                                onChange={(event) =>
                                  syncScript(
                                    {
                                      ...result.script,
                                      storyboard: {
                                        shots: result.script.storyboard!.shots.map((item) =>
                                          item.id === shot.id
                                            ? { ...item, duration_seconds: Number(event.target.value) || 1 }
                                            : item
                                        )
                                      }
                                    },
                                    "镜头时长已同步到 YAML"
                                  )
                                }
                              />
                            </label>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="emptyState">还没有分镜。点击“生成分镜”从 scenes.script 生成镜头 YAML。</div>
                    )}
                  </div>
                ) : null}

                {resultSubView === "prompts" ? (
                  <div className="cardGrid">
                    {(result.script.video_prompts ?? []).length ? (
                      result.script.video_prompts?.map((prompt) => (
                        <article className="videoChainCard" key={prompt.id}>
                          <div className="sectionHeader">
                            <h3>{prompt.id}</h3>
                            <span className="moduleState">{prompt.shot_id}</span>
                          </div>
                          <label>
                            Positive Prompt
                            <textarea
                              value={prompt.positive}
                              onChange={(event) =>
                                syncScript(
                                  {
                                    ...result.script,
                                    video_prompts: result.script.video_prompts!.map((item) =>
                                      item.id === prompt.id ? { ...item, positive: event.target.value } : item
                                    )
                                  },
                                  "视频 Prompt 已同步到 YAML"
                                )
                              }
                            />
                          </label>
                          <label>
                            Negative Prompt
                            <textarea
                              value={prompt.negative}
                              onChange={(event) =>
                                syncScript(
                                  {
                                    ...result.script,
                                    video_prompts: result.script.video_prompts!.map((item) =>
                                      item.id === prompt.id ? { ...item, negative: event.target.value } : item
                                    )
                                  },
                                  "负向 Prompt 已同步到 YAML"
                                )
                              }
                            />
                          </label>
                        </article>
                      ))
                    ) : (
                      <div className="emptyState">还没有视频 Prompt。点击“生成 Prompt”从分镜生成视频模型提示词。</div>
                    )}
                  </div>
                ) : null}

                {resultSubView === "video" ? (
                  <div className="cardGrid">
                    {(result.script.video_tasks ?? []).length ? (
                      result.script.video_tasks?.map((task) => (
                        <article className="videoChainCard" key={task.id}>
                          <div className="sectionHeader">
                            <h3>{task.id}</h3>
                            <span className={`moduleState ${task.status === "succeeded" ? "active" : ""}`}>
                              {task.status}
                            </span>
                          </div>
                          <p className="fieldHint">{task.prompt_id}</p>
                          {task.result_url ? (
                            <div className="videoPreviewBox">
                              <span>{task.result_url}</span>
                              <video controls src={task.result_url} />
                            </div>
                          ) : (
                            <p className="fieldHint">任务尚未产生结果 URL，刷新后 mock provider 会推进状态。</p>
                          )}
                          <button className="ghostButton" onClick={() => refreshVideoTask(task.id)} disabled={loading}>
                            刷新状态
                          </button>
                        </article>
                      ))
                    ) : (
                      <div className="emptyState">还没有视频任务。先生成 Prompt，再点击“提交 mock 视频”。</div>
                    )}
                  </div>
                ) : null}

                {resultSubView === "revision" ? (
                  <div className="revisionPanel">
                    <label>
                      反馈目标
                      <select
                        value={revisionTarget || revisionTargets[0]?.value || ""}
                        onChange={(event) => setRevisionTarget(event.target.value)}
                      >
                        {revisionTargets.map((target) => (
                          <option key={target.value} value={target.value}>
                            {target.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      作者反馈
                      <textarea
                        value={revisionFeedback}
                        onChange={(event) => setRevisionFeedback(event.target.value)}
                        placeholder="例如：镜头更贴近窗外雨滴，人物暂时不要入画。"
                      />
                    </label>
                    <button className="primaryButton" onClick={applyRevisionAction} disabled={loading || !revisionTargets.length}>
                      回写反馈
                    </button>
                    <div className="revisionLogList">
                      {(result.script.revision_log ?? []).map((revision) => (
                        <article key={revision.id}>
                          <strong>{revision.action}</strong>
                          <span>
                            {revision.scope.type} · {revision.scope.id}
                          </span>
                          <p>{revision.feedback}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
              );
            })() : null}

            {false && resultSubView === "yaml" ? (
              <section className="panel yamlPane mergedYamlPane">
              <div className="sectionHeader">
                <h2>合并后的剧本 YAML</h2>
                <div className="toolbar">
                  <button
                    className="iconButton"
                    title="保存合并 YAML"
                    onClick={saveResult}
                    disabled={!yaml || !allChaptersConfirmed}
                  >
                    <Save size={18} />
                  </button>
                  <button className="iconButton" title="校验 YAML" onClick={validateYaml} disabled={loading}>
                    <CheckCircle2 size={18} />
                  </button>
                  <button className="iconButton" title="修复 YAML" onClick={fixYaml} disabled={loading}>
                    <RefreshCw size={18} />
                  </button>
                  <button className="iconButton" title="复制 YAML" onClick={copyYaml} disabled={!yaml}>
                    <Clipboard size={18} />
                  </button>
                  <button
                    className="iconButton"
                    title="下载 YAML"
                    onClick={() => downloadText("scriptforge.yaml", yaml, "application/yaml;charset=utf-8")}
                    disabled={!yaml}
                  >
                    <Download size={18} />
                  </button>
                  <button
                    className="iconButton"
                    title="下载 Markdown 剧本"
                    onClick={() => downloadText("scriptforge-script.md", result?.markdown ?? "")}
                    disabled={!result?.markdown}
                  >
                    <FileText size={18} />
                  </button>
                </div>
              </div>
              <textarea
                className="yamlEditor"
                value={yaml}
                onChange={(event) => {
                  setYaml(event.target.value);
                  setResultSaved(false);
                  setSavedWorkflowStep("");
                }}
              />
              <div className={`validationBox ${isValid ? "ok" : ""}`}>
                <strong>{isValid ? "YAML 已通过 Schema 与引用校验" : "校验问题"}</strong>
                <IssueList issues={issues} />
              </div>
            </section>
            ) : null}
          </div>
        ) : null}

        {activeView === "versions" ? (
          <div className="versionsPage">
            <section className="panel versionLibrary">
              <div className="sectionHeader">
                <div>
                  <p className="eyebrow">保存版本</p>
                  <h2>YAML 版本库</h2>
                  <p>系统内保留最近 {YAML_VERSION_LIMIT} 次合并后的 YAML，可编辑，也可回溯到改编结果。</p>
                </div>
                <span className={`moduleState ${yamlVersions.length > 0 ? "active" : ""}`}>
                  {yamlVersions.length} 个版本
                </span>
              </div>

              {yamlVersions.length > 0 ? (
                <div className="versionList">
                  {yamlVersions.map((version) => (
                    <article
                      key={version.id}
                      className={`versionItem versionSelect ${selectedVersion?.id === version.id ? "active" : ""}`}
                    >
                      <button className="versionPickButton" onClick={() => selectYamlVersion(version)}>
                        <History size={16} />
                        <div>
                          <strong>{formatVersionTime(version.createdAt)}</strong>
                          <small>
                            {version.projectTitle} · {version.valid ? "校验通过" : `${version.issueCount} 个问题`} ·{" "}
                            {version.size} 字符
                          </small>
                        </div>
                      </button>
                      <button className="iconButton dangerButton" title="删除版本" onClick={() => deleteVersion(version)}>
                        <Trash2 size={16} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="emptyState">在“我的项目”的合并 YAML 区点击保存后，这里会出现可编辑版本。</p>
              )}
            </section>

            <section className="panel versionEditorPane">
              <div className="sectionHeader">
                <div>
                  <p className="eyebrow">版本编辑</p>
                  <h2>{selectedVersion ? formatVersionTime(selectedVersion.createdAt) : "暂无版本"}</h2>
                </div>
                <div className="toolbar">
                  <button className="ghostButton" onClick={saveVersionEdit} disabled={!selectedVersion}>
                    <Save size={16} />
                    保存编辑
                  </button>
                  <button
                    className="ghostButton"
                    onClick={() => selectedVersion && restoreYamlVersion(selectedVersion)}
                    disabled={!selectedVersion}
                  >
                    <RotateCcw size={16} />
                    回溯
                  </button>
                </div>
              </div>

              <textarea
                className="yamlEditor versionEditor"
                value={versionDraft}
                onChange={(event) => setVersionDraft(event.target.value)}
                disabled={!selectedVersion}
                placeholder="选择左侧版本后编辑 YAML"
              />
              {selectedVersion ? (
                <div className={`validationBox ${selectedVersion.valid ? "ok" : ""}`}>
                  <strong>{selectedVersion.valid ? "保存时已通过校验" : "保存时存在校验问题"}</strong>
                  <p className="compact">
                    {selectedVersion.projectTitle} · {selectedVersion.size} 字符 · 保存于{" "}
                    {formatVersionTime(selectedVersion.createdAt)}
                  </p>
                </div>
              ) : (
                <p className="emptyState">暂无可编辑版本。先在改编结果里保存合并后的 YAML。</p>
              )}
            </section>
          </div>
        ) : null}

        {activeView === "users" && isAdmin ? (
          <div className="usersPage">
            <div className="userManagementStack">
              <section className="panel userFormPanel">
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Admin</p>
                    <h2>{editingAccountId ? "编辑用户" : "新增用户"}</h2>
                  </div>
                  <UserCog size={18} />
                </div>
                <label>
                  用户名
                  <input
                    value={accountDraft.username}
                    onChange={(event) => setAccountDraft((current) => ({ ...current, username: event.target.value }))}
                  />
                </label>
                <label>
                  密码
                  <input
                    value={accountDraft.password}
                    onChange={(event) => setAccountDraft((current) => ({ ...current, password: event.target.value }))}
                  />
                </label>
                <div className="accountFormGrid">
                  <label>
                    角色
                    <select
                      value={accountDraft.role}
                      onChange={(event) =>
                        setAccountDraft((current) => ({ ...current, role: event.target.value as AccountDraft["role"] }))
                      }
                    >
                      <option value="admin">管理员</option>
                      <option value="user">用户</option>
                    </select>
                  </label>
                  <label>
                    状态
                    <select
                      value={accountDraft.status}
                      onChange={(event) =>
                        setAccountDraft((current) => ({
                          ...current,
                          status: event.target.value as AccountDraft["status"]
                        }))
                      }
                    >
                      <option value="active">启用</option>
                      <option value="disabled">停用</option>
                    </select>
                  </label>
                </div>
                <div className="buttonRow">
                  <button className="primaryButton" onClick={saveAccount}>
                    {editingAccountId ? "保存修改" : "创建用户"}
                  </button>
                  <button className="ghostButton" onClick={resetAccountForm}>
                    清空
                  </button>
                </div>
              </section>

              <section className="panel userTablePanel">
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Users</p>
                    <h2>用户管理</h2>
                  </div>
                  <span className="moduleState active">{accounts.length} 个账户</span>
                </div>
                <div className="accountTable">
                  <div className="accountTableHead">
                    <span>用户名</span>
                    <span>角色</span>
                    <span>状态</span>
                    <span>剩余次数</span>
                    <span>已用次数</span>
                    <span>创建时间</span>
                    <span>操作</span>
                  </div>
                  {accounts.map((account) => (
                    <div key={account.id} className="accountTableRow">
                      <strong>{account.username}</strong>
                      <span>{account.role === "admin" ? "管理员" : "用户"}</span>
                      <span className={`moduleState ${account.status === "active" ? "active" : ""}`}>
                        {account.status === "active" ? "启用" : "停用"}
                      </span>
                      <strong>{getRemainingRuns(account)} 次</strong>
                      <span>{account.quota.usedRuns} / {account.quota.totalRuns}</span>
                      <span>{formatVersionTime(account.createdAt)}</span>
                      <div className="tableActions">
                        <button className="ghostButton" onClick={() => editAccount(account)}>
                          编辑
                        </button>
                        <button className="iconButton dangerButton" title="删除用户" onClick={() => removeAccount(account)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="usageLogPanel">
                  <div className="sectionHeader">
                    <div>
                      <p className="eyebrow">Usage Log</p>
                      <h3>使用记录</h3>
                    </div>
                    <span className={`moduleState ${accountUsageRecords.length > 0 ? "active" : ""}`}>
                      {accountUsageRecords.length} 条记录
                    </span>
                  </div>
                  {accountUsageRecords.length > 0 ? (
                    <div className="usageLogList">
                      {accountUsageRecords.slice(0, 8).map((record) => (
                        <article key={record.id} className="usageLogItem">
                          <strong>{record.username}</strong>
                          <span>{record.action}</span>
                          <span>{record.cost > 0 ? `扣 ${record.cost} 次` : "不扣次数"}</span>
                          <span>{formatVersionTime(record.createdAt)}</span>
                          <small>{record.note}</small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="emptyState">用户完成生成后，这里会记录使用时间、操作和扣次情况。</p>
                  )}
                </div>
              </section>
            </div>

            <AdminProviderModule managedProviders={managedProviders} onChange={setManagedProviders} />
          </div>
        ) : null}

        {activeView === "schema" ? (
          <div className="schemaLayout">
            <section className="panel">
              <h2>YAML Schema 字段说明</h2>
              <div className="schemaGrid">
                {[
                  ["metadata", "记录标题、作者、生成器、版本和改编风格，方便管理不同改编稿。"],
                  ["source", "保留章节数量、章节 id、标题和摘要，让剧本与原小说保持映射。"],
                  ["characters", "建立人物表，场景只引用 id，避免称呼、关系和性格漂移。"],
                  ["locations", "建立地点表，统一场景描述，后续可扩展分镜、拍摄计划和预算。"],
                  ["timeline", "按事件顺序记录剧情推进，并可通过 conflict id 关联冲突。"],
                  ["conflicts", "记录冲突标题、参与人物、利害关系、来源章节和相关时间线。"],
                  ["story_structure", "抽取前提、主冲突、幕段、转折和人物弧，作为分镜与视频 prompt 的上游依据。"],
                  ["scenes", "每个场景包含来源、时间地点、人物、冲突引用、目的、节拍、动作/对白和改编策略。"]
                ].map(([name, description]) => (
                  <article key={name}>
                    <h3>{name}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="panel">
              <h2>示例 YAML</h2>
              <pre>{schemaExample}</pre>
            </section>
          </div>
        ) : null}

        {activeView === "pricing" ? (
          <PricingPage
            provider={provider}
            managedProviders={managedProviders}
            usageQuota={usageQuota}
            onProviderChange={setProvider}
          />
        ) : null}
      </section>
    </main>
  );
}
