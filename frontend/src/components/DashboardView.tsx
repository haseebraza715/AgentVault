"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageLayout from "@/components/PageLayout";
import SectionCard from "@/components/SectionCard";
import UploadCard from "@/components/UploadCard";
import DownloadCard from "@/components/DownloadCard";
import FooterStatus from "@/components/FooterStatus";
import StudioHero from "@/components/StudioHero";
import PreviewPanel from "@/components/PreviewPanel";
import ProgressBar from "@/components/ProgressBar";
import StepIndicator from "@/components/StepIndicator";
import Toast, { type ToastItem } from "@/components/Toast";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const STORAGE_KEY = "agentvault:lastJob";

type HealthState = {
  status: string;
  detail?: string;
};

type JobStatus = {
  status: string;
  processed: number;
  total: number;
  error?: string | null;
};

type StoredJob = {
  vaultId: string;
  status: JobStatus;
};

type ReportNote = {
  path: string;
  action:
    | "sanitized_only"
    | "llm_rewrite"
    | "fallback_sanitized"
    | "fallback_original"
    | "unchanged_original";
  reason: string;
  before_chars: number;
  after_chars: number;
  findings?: string[];
  requires_llm?: boolean;
  guards_failed: string[];
  retry_count?: number;
  chunked?: boolean;
};

type ReportCounts = {
  total_notes: number;
  rewritten_notes: number;
  skipped_notes: number;
  failed_validation_notes: number;
  llm_error_notes: number;
  unchanged_original_notes: number;
  metadata_only_notes: number;
  stub_notes: number;
};

type ProcessingReport = {
  summary: string;
  per_note: ReportNote[];
  counts?: ReportCounts;
};

type NoteDiff = {
  path: string;
  original: string;
  processed: string;
};

type SortKey = "path" | "action" | "reason" | "delta";
type SortDir = "asc" | "desc";
type HeroState = "idle" | "uploading" | "processing" | "done" | "error";

type DiffRow = {
  leftNo: number | null;
  rightNo: number | null;
  leftText: string;
  rightText: string;
  change: "same" | "added" | "removed" | "changed";
};

const ACTION_COLORS: Record<string, string> = {
  llm_rewrite: "bg-[#dff1e8] text-[#1f5d49]",
  sanitized_only: "bg-[#e5edf6] text-[#2f4a72]",
  unchanged_original: "bg-[#f0ece6] text-[#6f6458]",
  fallback_sanitized: "bg-[#fdeccc] text-[#8a6b2c]",
  fallback_original: "bg-[#f7dede] text-[#8b2b2b]",
};

const ACTION_RANK: Record<ReportNote["action"], number> = {
  llm_rewrite: 0,
  sanitized_only: 1,
  unchanged_original: 2,
  fallback_sanitized: 3,
  fallback_original: 4,
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "llm_rewrite", label: "Rewritten" },
  { value: "sanitized_only", label: "Skipped" },
  { value: "unchanged_original", label: "Unchanged" },
  { value: "fallback", label: "Fallback" },
];

function actionLabel(action: ReportNote["action"]): string {
  if (action === "llm_rewrite") return "Rewritten";
  if (action === "sanitized_only") return "Sanitized";
  if (action === "unchanged_original") return "Unchanged";
  if (action === "fallback_sanitized") return "Fallback (sanitized)";
  return "Fallback (original)";
}

function compactPath(path: string): string {
  if (path.length <= 72) return path;
  const head = path.slice(0, 42);
  const tail = path.slice(-24);
  return `${head}...${tail}`;
}

function sizeDelta(note: ReportNote): number {
  if (note.before_chars <= 0) return 0;
  return Math.round(((note.after_chars - note.before_chars) / note.before_chars) * 100);
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "<1m";
  const rounded = Math.round(seconds);
  const min = Math.floor(rounded / 60);
  const sec = rounded % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}m ${sec.toString().padStart(2, "0")}s`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function buildDiffRows(original: string, processed: string): DiffRow[] {
  const left = original.replace(/\r\n/g, "\n").split("\n");
  const right = processed.replace(/\r\n/g, "\n").split("\n");
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length || j < right.length) {
    const a = i < left.length ? left[i] : null;
    const b = j < right.length ? right[j] : null;

    if (a !== null && b !== null && a === b) {
      rows.push({ leftNo: i + 1, rightNo: j + 1, leftText: a, rightText: b, change: "same" });
      i += 1;
      j += 1;
      continue;
    }

    const nextLeft = i + 1 < left.length ? left[i + 1] : null;
    const nextRight = j + 1 < right.length ? right[j + 1] : null;

    if (a !== null && b !== null && nextLeft === b) {
      rows.push({ leftNo: i + 1, rightNo: null, leftText: a, rightText: "", change: "removed" });
      i += 1;
      continue;
    }

    if (a !== null && b !== null && a === nextRight) {
      rows.push({ leftNo: null, rightNo: j + 1, leftText: "", rightText: b, change: "added" });
      j += 1;
      continue;
    }

    if (a !== null && b !== null) {
      rows.push({ leftNo: i + 1, rightNo: j + 1, leftText: a, rightText: b, change: "changed" });
      i += 1;
      j += 1;
      continue;
    }

    if (a !== null) {
      rows.push({ leftNo: i + 1, rightNo: null, leftText: a, rightText: "", change: "removed" });
      i += 1;
      continue;
    }

    if (b !== null) {
      rows.push({ leftNo: null, rightNo: j + 1, leftText: "", rightText: b, change: "added" });
      j += 1;
    }
  }

  return rows;
}

function renderInlineDiff(left: string, right: string, side: "left" | "right") {
  if (left === right) {
    return side === "left" ? left : right;
  }

  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const leftMid = left.slice(prefix, left.length - suffix);
  const rightMid = right.slice(prefix, right.length - suffix);
  const prefixText = left.slice(0, prefix);
  const suffixText = left.slice(left.length - suffix);

  if (side === "left") {
    return (
      <>
        {prefixText}
        <span className="rounded-sm bg-[#f5cccc]">{leftMid || " "}</span>
        {suffixText}
      </>
    );
  }

  const rightPrefix = right.slice(0, prefix);
  const rightSuffix = right.slice(right.length - suffix);
  return (
    <>
      {rightPrefix}
      <span className="rounded-sm bg-[#cce8d7]">{rightMid || " "}</span>
      {rightSuffix}
    </>
  );
}

export default function DashboardView() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [report, setReport] = useState<ProcessingReport | null>(null);
  const [diffData, setDiffData] = useState<NoteDiff | null>(null);
  const [diffLoadingPath, setDiffLoadingPath] = useState<string | null>(null);
  const [diffFullscreen, setDiffFullscreen] = useState(false);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("action");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [zipSizeLabel, setZipSizeLabel] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const toastIdRef = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((type: ToastItem["type"], message: string) => {
    const id = toastIdRef.current;
    toastIdRef.current += 1;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => dismissToast(id), 4000);
  }, [dismissToast]);

  const clearExpiredJob = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setVaultId(null);
    setJobStatus(null);
    setReport(null);
    setDiffData(null);
    setExpandedRows({});
    setZipSizeLabel(null);
    startedAtRef.current = null;
  };

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as StoredJob;
      setVaultId(parsed.vaultId);
      setJobStatus(parsed.status);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/health`);
        if (!res.ok) {
          setHealth({ status: "error", detail: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as { status: string };
        setHealth({ status: data.status });
      } catch (err) {
        setHealth({ status: "error", detail: (err as Error).message });
      }
    };

    checkHealth();
  }, []);

  useEffect(() => {
    if (!vaultId) return;

    let active = true;

    const pollStatus = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/status/${vaultId}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (active) {
              clearExpiredJob();
              setError("This job expired. Upload the vault again to continue.");
            }
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as JobStatus;
        if (!active) return;

        if (data.status === "processing" && data.processed > 0 && startedAtRef.current === null) {
          startedAtRef.current = Date.now();
        }

        setJobStatus(data);
        if (data.status === "done" || data.status === "error") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ vaultId, status: data }));
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (err) {
        if (!active) return;
        setError((err as Error).message);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    };

    pollStatus();
    pollRef.current = setInterval(pollStatus, 2000);

    return () => {
      active = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [vaultId]);

  useEffect(() => {
    const status = jobStatus?.status || null;
    if (!status || prevStatusRef.current === status) return;

    if (status === "done") pushToast("success", "Processing complete. Downloads are ready.");
    if (status === "error") pushToast("error", jobStatus?.error || "Processing failed.");

    prevStatusRef.current = status;
  }, [jobStatus?.status, jobStatus?.error, pushToast]);

  useEffect(() => {
    if (!error) return;
    pushToast("error", error);
  }, [error, pushToast]);

  useEffect(() => {
    if (!vaultId || jobStatus?.status !== "done") return;
    let active = true;

    const fetchReport = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/report/${vaultId}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (active) {
              clearExpiredJob();
              setError("Report expired. Upload the vault again to generate a new report.");
            }
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as ProcessingReport;
        if (active) {
          setReport(data);
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message);
        }
      }
    };

    fetchReport();
    return () => {
      active = false;
    };
  }, [vaultId, jobStatus?.status]);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a zip file.");
      return;
    }
    setError(null);
    setUploading(true);
    setUploadSuccess(false);
    setVaultId(null);
    setJobStatus(null);
    setReport(null);
    setDiffData(null);
    setActionFilter("all");
    setSearchQuery("");
    setExpandedRows({});
    setZipSizeLabel(null);
    startedAtRef.current = null;
    window.localStorage.removeItem(STORAGE_KEY);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiBaseUrl}/upload-vault`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Upload failed");
      }

      const data = (await res.json()) as { vault_id: string };
      setVaultId(data.vault_id);
      setUploadSuccess(true);
      pushToast("success", "Upload successful. Processing started.");
      window.setTimeout(() => setUploadSuccess(false), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const downloadUrl = vaultId ? `${apiBaseUrl}/download/${vaultId}` : null;
  const previewUrl = vaultId ? `${apiBaseUrl}/preview/${vaultId}` : null;
  const reportUrl = vaultId ? `${apiBaseUrl}/report/${vaultId}` : null;
  const statusText = jobStatus
    ? `${jobStatus.status} (${jobStatus.processed}/${jobStatus.total})`
    : null;

  useEffect(() => {
    if (jobStatus?.status !== "done" || !downloadUrl) {
      setZipSizeLabel(null);
      return;
    }
    let active = true;
    const getZipSize = async () => {
      try {
        const res = await fetch(downloadUrl, { method: "HEAD" });
        if (!res.ok) return;
        const sizeHeader = res.headers.get("content-length");
        if (!sizeHeader) return;
        const parsed = Number(sizeHeader);
        if (active && Number.isFinite(parsed) && parsed > 0) {
          setZipSizeLabel(formatBytes(parsed));
        }
      } catch {
        // Best-effort metadata; keep UI functional if header is unavailable.
      }
    };
    getZipSize();
    return () => {
      active = false;
    };
  }, [jobStatus?.status, downloadUrl]);

  const heroState: HeroState = uploading
    ? "uploading"
    : jobStatus?.status === "processing"
      ? "processing"
      : jobStatus?.status === "done"
        ? "done"
        : jobStatus?.status === "error"
          ? "error"
          : "idle";

  const etaLabel = useMemo(() => {
    if (jobStatus?.status !== "processing" || !jobStatus.total || !jobStatus.processed) return "";
    if (!startedAtRef.current) return "";
    const elapsed = (Date.now() - startedAtRef.current) / 1000;
    if (elapsed <= 0) return "";
    const rate = jobStatus.processed / elapsed;
    if (rate <= 0) return "";
    const remaining = Math.max(0, jobStatus.total - jobStatus.processed) / rate;
    return formatEta(remaining);
  }, [jobStatus?.status, jobStatus?.processed, jobStatus?.total]);

  const reportStats = useMemo(() => {
    if (!report) {
      return { rewritten: 0, skipped: 0, unchanged: 0, fallback: 0, total: 0 };
    }
    let rewritten = 0;
    let skipped = 0;
    let unchanged = 0;
    let fallback = 0;
    for (const note of report.per_note) {
      if (note.action === "llm_rewrite") rewritten += 1;
      else if (note.action === "sanitized_only") skipped += 1;
      else if (note.action === "unchanged_original") unchanged += 1;
      else fallback += 1;
    }
    return { rewritten, skipped, unchanged, fallback, total: report.per_note.length };
  }, [report]);

  const filteredNotes = useMemo(() => {
    if (!report) return [];
    const filtered = report.per_note.filter((note) => {
      if (actionFilter !== "all") {
        if (actionFilter === "fallback") {
          if (!note.action.startsWith("fallback")) return false;
        } else if (note.action !== actionFilter) {
          return false;
        }
      }
      if (searchQuery && !note.path.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let value = 0;
      if (sortKey === "path") {
        value = a.path.localeCompare(b.path);
      } else if (sortKey === "action") {
        value = ACTION_RANK[a.action] - ACTION_RANK[b.action] || a.path.localeCompare(b.path);
      } else if (sortKey === "reason") {
        value = a.reason.localeCompare(b.reason) || a.path.localeCompare(b.path);
      } else {
        value = sizeDelta(a) - sizeDelta(b);
      }
      return sortDir === "asc" ? value : -value;
    });

    return sorted;
  }, [report, actionFilter, searchQuery, sortKey, sortDir]);

  const handleViewDiff = async (notePath: string) => {
    if (!vaultId) return;
    setDiffLoadingPath(notePath);
    try {
      const res = await fetch(`${apiBaseUrl}/diff/${vaultId}?path=${encodeURIComponent(notePath)}`);
      if (!res.ok) {
        if (res.status === 404) {
          clearExpiredJob();
          setError("This job expired. Upload the vault again to view diffs.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as NoteDiff;
      setDiffData(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDiffLoadingPath(null);
    }
  };

  const diffRows = useMemo(() => {
    if (!diffData) return [];
    return buildDiffRows(diffData.original, diffData.processed);
  }, [diffData]);

  const setSort = (next: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === next) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return next;
    });
  };

  const toggleExpanded = (path: string) => {
    setExpandedRows((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const onCopy = async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      pushToast("info", `${label} copied`);
    } catch {
      pushToast("error", "Unable to copy text");
    }
  };

  const counts = report?.counts;
  const showSkeleton = health.status === "loading";

  const diffPanel = diffData ? (
    <div
      className={`${diffFullscreen ? "fixed inset-3 z-40 overflow-hidden rounded-lg border border-[#d8cab9] bg-white p-2.5" : "mt-3 rounded-lg border border-[#ddd1c3] bg-[#fbf8f3] p-2.5 reveal-section"}`}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h4 className="max-w-[78ch] truncate text-xs font-semibold text-[#2b241e]" title={diffData.path}>{diffData.path}</h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDiffFullscreen((prev) => !prev)}
            className="rounded-md border border-[#d1c2b2] bg-white px-2 py-0.5 text-[10px] text-[#5f564c]"
          >
            {diffFullscreen ? "Exit full screen" : "Full screen"}
          </button>
          <button
            type="button"
            onClick={() => setDiffData(null)}
            className="rounded-md border border-[#d1c2b2] bg-white px-2 py-0.5 text-[10px] text-[#5f564c]"
          >
            Close
          </button>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-[#ddd1c3] bg-white">
          <div className="flex items-center justify-between border-b border-[#eee4d9] bg-[#f7f2ea] px-2 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8b7c6d]">Original</p>
            <button
              type="button"
              onClick={() => onCopy(diffData.original, "Original note")}
              className="rounded-md border border-[#d6c8b8] bg-white px-2 py-0.5 text-[10px] text-[#6f6458]"
            >
              Copy
            </button>
          </div>
          <div className="max-h-[420px] overflow-auto p-1 text-[10px] leading-relaxed">
            {diffRows.map((row, index) => (
              <div
                key={`left-${index}`}
                className={`grid grid-cols-[30px_1fr] gap-1.5 rounded px-1 py-0.5 font-mono ${
                  row.change === "removed"
                    ? "bg-[#f8e7e7]"
                    : row.change === "changed"
                      ? "bg-[#fff1f1]"
                      : "bg-transparent"
                }`}
              >
                <span className="text-[10px] text-[#9a8878]">{row.leftNo ?? ""}</span>
                <span className="whitespace-pre-wrap break-words text-[#2b241e]">
                  {row.change === "changed"
                    ? renderInlineDiff(row.leftText, row.rightText, "left")
                    : row.leftText}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#ddd1c3] bg-white">
          <div className="flex items-center justify-between border-b border-[#eee4d9] bg-[#f7f2ea] px-2 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8b7c6d]">Processed</p>
            <button
              type="button"
              onClick={() => onCopy(diffData.processed, "Processed note")}
              className="rounded-md border border-[#d6c8b8] bg-white px-2 py-0.5 text-[10px] text-[#6f6458]"
            >
              Copy
            </button>
          </div>
          <div className="max-h-[420px] overflow-auto p-1 text-[10px] leading-relaxed">
            {diffRows.map((row, index) => (
              <div
                key={`right-${index}`}
                className={`grid grid-cols-[30px_1fr] gap-1.5 rounded px-1 py-0.5 font-mono ${
                  row.change === "added"
                    ? "bg-[#e8f6ec]"
                    : row.change === "changed"
                      ? "bg-[#eefaf2]"
                      : "bg-transparent"
                }`}
              >
                <span className="text-[10px] text-[#9a8878]">{row.rightNo ?? ""}</span>
                <span className="whitespace-pre-wrap break-words text-[#2b241e]">
                  {row.change === "changed"
                    ? renderInlineDiff(row.leftText, row.rightText, "right")
                    : row.rightText}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <PageLayout>
      <StudioHero
        state={heroState}
        processed={jobStatus?.processed || 0}
        total={jobStatus?.total || 0}
      />

      <StepIndicator stage={heroState === "error" ? "error" : heroState} />

      {jobStatus?.status === "processing" ? (
        <ProgressBar
          current={jobStatus.processed}
          total={jobStatus.total}
          etaLabel={etaLabel}
        />
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Upload" description="Upload a vault zip to begin processing.">
          {showSkeleton ? (
            <div className="space-y-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-10 rounded-full" />
            </div>
          ) : (
            <UploadCard
              uploading={uploading}
              uploadSuccess={uploadSuccess}
              selectedFile={file}
              processing={jobStatus?.status === "processing"}
              onSelectFile={setFile}
              onUpload={handleUpload}
              error={jobStatus?.status === "error" ? jobStatus.error : error}
              statusText={statusText}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Downloads"
          description="Grab the cleaned vault, preview markdown, and processing report."
        >
          {showSkeleton ? (
            <div className="space-y-3">
              <div className="skeleton h-12 rounded-xl" />
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="skeleton h-10 rounded-xl" />
                <div className="skeleton h-10 rounded-xl" />
                <div className="skeleton h-10 rounded-xl" />
              </div>
            </div>
          ) : (
            <DownloadCard
              zipUrl={downloadUrl}
              previewUrl={previewUrl}
              reportUrl={reportUrl}
              enabled={jobStatus?.status === "done"}
              noteCount={counts?.total_notes}
              zipSizeLabel={zipSizeLabel}
              onDownload={(label) => pushToast("info", label)}
            />
          )}
        </SectionCard>
      </div>

      {jobStatus?.status === "done" && counts ? (
        <div className="reveal-section space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Total", value: counts.total_notes, color: "text-[#2b241e]" },
              { label: "Rewritten", value: counts.rewritten_notes, color: "text-[#216149]" },
              { label: "Skipped", value: counts.skipped_notes, color: "text-[#6f6458]" },
              { label: "Unchanged", value: counts.unchanged_original_notes, color: "text-[#5f564c]" },
              {
                label: "Fallback",
                value: counts.failed_validation_notes + counts.llm_error_notes,
                color: "text-[#8a6b2c]",
              },
              {
                label: "Stubs",
                value: counts.stub_notes + counts.metadata_only_notes,
                color: "text-[#6f6458]",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-[#dfd3c5] bg-white px-2.5 py-1.5 text-center"
              >
                <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] font-medium text-[#8b7c6d]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[#dfd3c5] bg-white p-2">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#6f6458]">
              <p>Outcome distribution</p>
              <p className="tabular-nums">{reportStats.total} notes</p>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full border border-[#d8cab9] bg-[#efe3d4] p-0.5">
              {[
                {
                  label: "Rewritten",
                  value: reportStats.rewritten,
                  className: "bg-[#1f4d45]",
                  filter: "llm_rewrite",
                },
                {
                  label: "Skipped",
                  value: reportStats.skipped,
                  className: "bg-[#9ca8b7]",
                  filter: "sanitized_only",
                },
                {
                  label: "Fallback",
                  value: reportStats.fallback,
                  className: "bg-[#d8a659]",
                  filter: "fallback",
                },
                {
                  label: "Unchanged",
                  value: reportStats.unchanged,
                  className: "bg-[#d9cec0]",
                  filter: "unchanged_original",
                },
              ]
                .filter((segment) => segment.value > 0)
                .map((segment) => (
                  <button
                    key={segment.label}
                    type="button"
                    title={`${segment.label}: ${segment.value}`}
                    onClick={() => setActionFilter(segment.filter)}
                    className={`${segment.className} h-full rounded-full transition`}
                    style={{ width: `${(segment.value / Math.max(1, reportStats.total)) * 100}%` }}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : null}

      <SectionCard title="Preview" description="View the full markdown preview in your browser.">
        <PreviewPanel previewUrl={previewUrl} enabled={jobStatus?.status === "done"} />
      </SectionCard>

      {jobStatus?.status === "done" && report ? (
        <SectionCard title="Report" description="Per-note processing actions and diffs.">
          <p className="text-xs text-[#4f453b]">{report.summary}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActionFilter(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    actionFilter === opt.value
                      ? "bg-[#1f4d45] text-white"
                      : "border border-[#d9c8b5] bg-white text-[#5f564c] hover:bg-[#f5ede2]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search by path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-md border border-[#d8c7b4] bg-white px-2.5 py-1 text-xs text-[#2b241e] placeholder-[#b5a99a] outline-none focus:border-[#143f38]"
            />
            <span className="text-xs font-semibold text-[#8b7c6d]">
              {filteredNotes.length} / {report.per_note.length} notes
            </span>
          </div>

          <div className="mt-2.5 max-h-[460px] overflow-auto rounded-lg border border-[#d8c7b4] bg-white">
            <div className="min-w-[720px]">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-[#f5eee4]">
                  <tr>
                    {[
                      { label: "Path", key: "path" as SortKey },
                      { label: "Action", key: "action" as SortKey },
                      { label: "Reason", key: "reason" as SortKey },
                      { label: "Delta Size", key: "delta" as SortKey },
                    ].map((head) => (
                      <th key={head.key} className="px-2.5 py-1.5 font-semibold text-[#5f564c]">
                        <button
                          type="button"
                          onClick={() => setSort(head.key)}
                          className="inline-flex items-center gap-1.5"
                        >
                          {head.label}
                          <span className="text-[10px] text-[#9a8878]">
                            {sortKey === head.key ? (sortDir === "asc" ? "^" : "v") : "<>"}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-2.5 py-1.5 font-semibold text-[#5f564c]">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotes.map((note) => {
                    const delta = sizeDelta(note);
                    const actionColor = ACTION_COLORS[note.action] || "bg-[#f3f1ee] text-[#6f6458]";
                    const expanded = !!expandedRows[note.path];
                    return (
                      <Fragment key={`${note.path}-${note.action}`}>
                        <tr
                          className="cursor-pointer border-t border-[#efe3d5] transition hover:bg-[#f9f4ec]"
                          onClick={() => toggleExpanded(note.path)}
                        >
                          <td className="max-w-[220px] truncate px-2.5 py-1.5" title={note.path}>
                            <span className="font-mono text-[12px] text-[#3f3a34]">{compactPath(note.path)}</span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionColor}`}>
                              {actionLabel(note.action)}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 text-[#6f6458]">{note.reason}</td>
                          <td className="px-2.5 py-1.5 tabular-nums">
                            <span
                              className={
                                delta > 0
                                  ? "font-semibold text-[#216149]"
                                  : delta < 0
                                    ? "font-semibold text-[#8b2b2b]"
                                    : "text-[#6f6458]"
                              }
                            >
                              {delta > 0 ? "+" : ""}
                              {delta}%
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleViewDiff(note.path);
                              }}
                              disabled={diffLoadingPath === note.path}
                              className="rounded-md border border-[#d0bda8] px-2 py-0.5 text-[10px] font-medium text-[#5f564c] transition hover:bg-[#f5ecdf] disabled:opacity-50"
                            >
                              {diffLoadingPath === note.path ? "..." : "View diff"}
                            </button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-t border-[#ebddcd] bg-[#fffaf4]">
                            <td colSpan={5} className="px-2.5 py-2">
                              <div className="grid gap-2 text-[10px] text-[#5f564c] sm:grid-cols-2">
                                <div>
                                  <p className="font-semibold text-[#2b241e]">Findings</p>
                                  <p>{note.findings?.length ? note.findings.join(", ") : "None"}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-[#2b241e]">Guard failures</p>
                                  <p>{note.guards_failed?.length ? note.guards_failed.join(", ") : "None"}</p>
                                </div>
                                <div className="sm:col-span-2">
                                  <p className="font-semibold text-[#2b241e]">Details</p>
                                  <p className="tabular-nums">
                                    before {note.before_chars} - after {note.after_chars} - retries {note.retry_count || 0} - chunked {note.chunked ? "yes" : "no"}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {diffPanel}
        </SectionCard>
      ) : null}

      <FooterStatus status={health.status} />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </PageLayout>
  );
}
