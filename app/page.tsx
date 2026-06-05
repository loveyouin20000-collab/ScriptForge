"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Download,
  FileText,
  Gauge,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2
} from "lucide-react";
import { useMemo, useState } from "react";
import { chaptersFromManualText, splitChapters } from "@/lib/chapterSplitter";
import type { Chapter, ProviderConfig, ScriptYaml, ValidationIssue } from "@/lib/types";

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
    purpose: 引出主线悬念
    beats:
      - 林晚独自等待
    script:
      - type: action
        content: 雨水拍打着玻璃窗。`;

const providerPresets = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"]
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"]
  },
  tongyi: {
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-turbo", "qwen-max"]
  },
  custom: {
    label: "自定义兼容接口",
    baseUrl: "",
    models: []
  }
} as const;

type ProviderVendor = keyof typeof providerPresets;

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

function ProviderModule({
  provider,
  onChange
}: {
  provider: ProviderConfig;
  onChange: (provider: ProviderConfig) => void;
}) {
  const selectedVendor = (provider.vendor ?? "openai") as ProviderVendor;
  const selectedPreset = providerPresets[selectedVendor];
  const usesMock = !provider.apiKey || !provider.model;

  function changeVendor(vendor: ProviderVendor) {
    const preset = providerPresets[vendor];
    onChange({
      ...provider,
      vendor,
      baseUrl: vendor === "custom" ? "" : preset.baseUrl,
      model: vendor === "custom" ? "" : preset.models[0] ?? ""
    });
  }

  return (
    <section className="providerModule">
      <div className="moduleHeader">
        <div>
          <p className="eyebrow">LLM Provider</p>
          <h2>大模型服务商</h2>
        </div>
        <span className={`moduleState ${usesMock ? "" : "active"}`}>{usesMock ? "本地 mock" : "远程调用"}</span>
      </div>
      <div className="providerGrid">
        <label>
          AI 服务商
          <select value={selectedVendor} onChange={(event) => changeVendor(event.target.value as ProviderVendor)}>
            {Object.entries(providerPresets).map(([value, preset]) => (
              <option key={value} value={value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        {selectedVendor === "custom" ? (
          <label>
            兼容接口地址
            <input
              placeholder="如 https://api.example.com/v1"
              value={provider.baseUrl ?? ""}
              onChange={(event) => onChange({ ...provider, baseUrl: event.target.value })}
            />
          </label>
        ) : (
          <div className="providerInfo">
            <span>{selectedPreset.label} 服务地址</span>
            <code>{selectedPreset.baseUrl}</code>
          </div>
        )}
        <label>
          模型
          <input
            list="model-options"
            placeholder={selectedPreset.models[0] ? `如 ${selectedPreset.models[0]}` : "填写兼容接口支持的模型"}
            value={provider.model ?? ""}
            onChange={(event) => onChange({ ...provider, model: event.target.value })}
          />
          <datalist id="model-options">
            {selectedPreset.models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>
        <label>
          API Key
          <input
            type="password"
            placeholder="留空则使用本地 mock"
            value={provider.apiKey ?? ""}
            onChange={(event) => onChange({ ...provider, apiKey: event.target.value })}
          />
        </label>
      </div>
      <p className="fieldHint">
        {usesMock
          ? "这个模块独立管理 AI 调用配置；模型或 API Key 留空时，流水线使用本地 mock。"
          : `流水线生成阶段将调用 ${selectedPreset.label} 的 ${provider.model} 模型。`}
      </p>
    </section>
  );
}

function PricingPage() {
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
      <section className="pricingHero">
        <div>
          <p className="eyebrow">Pricing</p>
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
  const [activeView, setActiveView] = useState<"input" | "chapters" | "result" | "schema" | "pricing">("input");
  const [title, setTitle] = useState("雨夜旧案");
  const [author, setAuthor] = useState("原作者");
  const [text, setText] = useState(sampleText);
  const [provider, setProvider] = useState<ProviderConfig>({
    vendor: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: ""
  });
  const [chapters, setChapters] = useState<Chapter[]>(() => splitChapters(sampleText));
  const [manualChapters, setManualChapters] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [yaml, setYaml] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("准备就绪");
  const [error, setError] = useState("");

  const completion = useMemo(() => {
    if (result) return 100;
    if (chapters.length >= 3) return 42;
    if (text.trim()) return 24;
    return 8;
  }, [chapters.length, result, text]);

  function parseChapters() {
    const parsed = splitChapters(text);
    setChapters(parsed);
    setManualChapters(
      parsed
        .map((chapter) => `${chapter.title}\n${chapter.text}`)
        .join("\n\n---\n\n")
    );
    setActiveView("chapters");
    setStatus(parsed.length >= 3 ? `已识别 ${parsed.length} 个章节` : "章节少于 3 个，仍可演示生成");
  }

  function applyManualChapters() {
    const parsed = chaptersFromManualText(manualChapters);
    setChapters(parsed);
    setStatus(`已应用 ${parsed.length} 个手动章节`);
  }

  async function runGeneration() {
    setLoading(true);
    setError("");
    setStatus("正在执行章节理解、故事建模和场景生成");
    try {
      const response = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          text,
          chapters,
          provider
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "生成失败");
      setResult(payload);
      setYaml(payload.yaml);
      setIssues(payload.validation.issues);
      setIsValid(payload.validation.valid);
      setActiveView("result");
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
    setStatus(`已读取文件：${file.name}`);
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
              ["input", "项目输入"],
              ["chapters", "章节解析"],
              ["result", "改编结果"],
              ["schema", "Schema 文档"],
              ["pricing", "Pricing"]
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

        {activeView === "input" ? (
          <div className="inputStack">
            <div className="panel inputGrid">
              <section className="formColumn">
                <label>
                  小说标题
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label>
                  作者
                  <input value={author} onChange={(event) => setAuthor(event.target.value)} />
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
                  <button className="primaryButton" onClick={parseChapters}>
                    <Play size={18} />
                    解析章节
                  </button>
                </div>
              </section>
              <section className="editorColumn">
                <label>
                  小说文本
                  <textarea value={text} onChange={(event) => setText(event.target.value)} />
                </label>
              </section>
            </div>
            <ProviderModule provider={provider} onChange={setProvider} />
          </div>
        ) : null}

        {activeView === "chapters" ? (
          <div className="panel chapterLayout">
            <section>
              <div className="sectionHeader">
                <h2>识别到的章节</h2>
                <button className="primaryButton" onClick={runGeneration} disabled={loading}>
                  <Wand2 size={18} />
                  {loading ? "生成中" : "生成改编"}
                </button>
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
                <button className="ghostButton" onClick={applyManualChapters}>
                  应用调整
                </button>
              </div>
              <textarea
                className="manualEditor"
                value={manualChapters}
                onChange={(event) => setManualChapters(event.target.value)}
                placeholder="每章之间使用单独一行 --- 分隔"
              />
            </section>
          </div>
        ) : null}

        {activeView === "result" ? (
          <div className="resultLayout">
            <section className="panel summaryPane">
              <div className="sectionHeader">
                <h2>章节理解</h2>
                <FileText size={18} />
              </div>
              {result?.chapters.map((chapter) => (
                <details key={chapter.id} open>
                  <summary>
                    <span>{chapter.id}</span>
                    {chapter.title}
                  </summary>
                  <p>{chapter.summary}</p>
                  <dl>
                    <dt>人物</dt>
                    <dd>{chapter.main_characters?.join("、")}</dd>
                    <dt>地点</dt>
                    <dd>{chapter.locations?.join("、")}</dd>
                    <dt>事件</dt>
                    <dd>{chapter.key_events?.join("；")}</dd>
                  </dl>
                </details>
              ))}
            </section>
            <section className="panel yamlPane">
              <div className="sectionHeader">
                <h2>剧本 YAML</h2>
                <div className="toolbar">
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
              <textarea className="yamlEditor" value={yaml} onChange={(event) => setYaml(event.target.value)} />
              <div className={`validationBox ${isValid ? "ok" : ""}`}>
                <strong>{isValid ? "YAML 已通过 Schema 与引用校验" : "校验问题"}</strong>
                <IssueList issues={issues} />
              </div>
            </section>
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
                  ["timeline", "按事件顺序记录剧情推进，帮助检查改编后的时间线。"],
                  ["scenes", "每个场景包含来源、时间地点、人物、目的、节拍、动作/对白和改编策略。"]
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

        {activeView === "pricing" ? <PricingPage /> : null}
      </section>
    </main>
  );
}
