import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ShieldAlert, ShieldCheck, Clock, FileText,
  ChevronLeft, ChevronRight, Trash2, Loader2, Play,
  AlertCircle, HardDrive, Calendar, Tag, BarChart2, AlignLeft, Shield,
  EyeOff, Download, Eye
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/api";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useAuth } from "@/context/AuthContext";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const PROCESSING_TYPES = [
  {
    id: "pii",
    label: "PII Detection",
    description: "Scan for personally identifiable information using Amazon Comprehend.",
    available: true,
  },
  {
    id: "classification",
    label: "Document Classification",
    description: "Classify document type and extract key metadata using Amazon Bedrock.",
    available: false,
  },
  {
    id: "summarization",
    label: "Summarization",
    description: "Generate a concise summary of the document using Amazon Bedrock.",
    available: true,
  },
];

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

function StatusBadge({ status }) {
  const map = {
    pending:    { label: "Pending",    className: "bg-gray-800 text-gray-300 border-gray-700" },
    processing: { label: "Processing", className: "bg-amber-900/40 text-amber-400 border-amber-700" },
    complete:   { label: "Complete",   className: "bg-emerald-900/40 text-emerald-400 border-emerald-700" },
    failed:     { label: "Failed",     className: "bg-red-900/40 text-red-400 border-red-700" },
  };
  const s = map[status] ?? map.pending;
  return (
    <Badge variant="outline" className={`text-xs font-medium ${s.className}`}>
      <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </Badge>
  );
}

function RiskBadge({ level }) {
  const map = {
    none:   { label: "No PII",      className: "bg-emerald-900/40 text-emerald-400 border-emerald-700" },
    low:    { label: "Low Risk",    className: "bg-blue-900/40 text-blue-400 border-blue-700" },
    medium: { label: "Medium Risk", className: "bg-amber-900/40 text-amber-400 border-amber-700" },
    high:   { label: "High Risk",   className: "bg-red-900/40 text-red-400 border-red-700" },
  };
  const r = map[level] ?? map.none;
  return (
    <Badge variant="outline" className={`text-xs font-medium ${r.className}`}>
      {r.label}
    </Badge>
  );
}

function ProcessingModal({ open, onOpenChange, onConfirm, processing }) {
  const [selected, setSelected] = useState("pii");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run Analysis</DialogTitle>
          <DialogDescription>
            Select a processing type to run on this document.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          {PROCESSING_TYPES.map((type) => (
            <button
              key={type.id}
              disabled={!type.available || processing}
              onClick={() => type.available && setSelected(type.id)}
              className={`w-full text-left rounded-md border px-4 py-3 transition-colors
                ${!type.available
                  ? "border-gray-800 opacity-40 cursor-not-allowed"
                  : selected === type.id
                    ? "border-blue-600 bg-blue-950/30"
                    : "border-gray-800 hover:border-gray-600 cursor-pointer"
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-200">{type.label}</span>
                {!type.available && (
                  <span className="text-[10px] text-gray-600 uppercase tracking-wide">Coming soon</span>
                )}
                {type.available && selected === type.id && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-500">{type.description}</p>
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selected)}
            disabled={processing}
            className="min-w-28"
          >
            {processing && <Loader2 className="w-4 h-4 animate-spin" />}
            {processing ? "Starting..." : "Run Analysis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Key Info Sidebar ─────────────────────────────────────────────────────────

function KeyInfoSidebar({ doc, onRunAnalysis, onRunRedaction, activeTab, onTabChange }) {
  const pii = doc.piiDetection ?? null;
  const summary = doc.summarizationResults ?? null;
  const redaction = doc.redactionResults ?? null;

  const piiStatus = pii?.status ?? null;
  const summaryStatus = summary?.status ?? null;
  const redactionStatus = redaction?.status ?? null;
  const piiComplete = piiStatus === "complete";

  const uploadedDate = doc.uploadedAt
    ? new Date(doc.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : doc.sortKey?.split("#")[1]
      ? new Date(doc.sortKey.split("#")[1]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "—";

  const fileSizeLabel = doc.fileSize
    ? doc.fileSize >= 1024 * 1024
      ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${(doc.fileSize / 1024).toFixed(1)} KB`
    : "—";

  return (
    <div className="w-[300px] shrink-0 flex flex-col gap-0 border-l border-gray-800">

      {/* Document meta */}
      <div className="p-5 border-b border-gray-800 space-y-3">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">Document Info</p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500">
              <Tag className="w-3.5 h-3.5" />
              <span className="text-xs">Type</span>
            </div>
            <span className="text-xs font-mono text-gray-400">{doc.fileType ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500">
              <HardDrive className="w-3.5 h-3.5" />
              <span className="text-xs">Size</span>
            </div>
            <span className="text-xs text-gray-400">{fileSizeLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs">Uploaded</span>
            </div>
            <span className="text-xs text-gray-400">{uploadedDate}</span>
          </div>
        </div>
      </div>

      {/* PII summary */}
      <div
        className={`p-5 border-b border-gray-800 cursor-pointer transition-colors ${activeTab === "pii" ? "bg-gray-800/40" : "hover:bg-gray-800/20"}`}
        onClick={() => onTabChange(activeTab === "pii" ? null : "pii")}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">PII Detection</p>
          </div>
          {activeTab === "pii" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
        </div>

        {!pii && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Not yet run</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-500 hover:text-gray-300 gap-1"
              onClick={(e) => { e.stopPropagation(); onRunAnalysis(); }}>
              <Play className="w-3 h-3" /> Run
            </Button>
          </div>
        )}
        {pii && (piiStatus === "pending" || piiStatus === "processing") && (
          <div className="flex items-center gap-2 text-amber-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">Running…</span>
          </div>
        )}
        {pii && piiStatus === "failed" && (
          <span className="text-xs text-red-400">Detection failed</span>
        )}
        {pii && piiStatus === "complete" && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {pii.riskLevel === "none"
                ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                : <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              }
              <span className="text-xs text-gray-400">
                {pii.entityCount} {pii.entityCount === 1 ? "entity" : "entities"}
              </span>
            </div>
            <RiskBadge level={pii.riskLevel} />
          </div>
        )}
      </div>

      {/* Redaction summary */}
      <div
        className={`p-5 border-b border-gray-800 transition-colors ${piiComplete ? "cursor-pointer" : "opacity-50 cursor-not-allowed"} ${activeTab === "redaction" ? "bg-gray-800/40" : piiComplete ? "hover:bg-gray-800/20" : ""}`}
        onClick={() => piiComplete && onTabChange(activeTab === "redaction" ? null : "redaction")}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">Redaction</p>
          </div>
          {activeTab === "redaction" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
        </div>

        {!piiComplete && (
          <span className="text-xs text-gray-600">Requires PII detection</span>
        )}
        {piiComplete && !redaction && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Not yet run</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-500 hover:text-gray-300 gap-1"
              onClick={(e) => { e.stopPropagation(); onRunRedaction(); }}>
              <Play className="w-3 h-3" /> Run
            </Button>
          </div>
        )}
        {redaction && (redactionStatus === "pending" || redactionStatus === "processing") && (
          <div className="flex items-center gap-2 text-amber-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">Redacting…</span>
          </div>
        )}
        {redaction && redactionStatus === "failed" && (
          <span className="text-xs text-red-400">Redaction failed</span>
        )}
        {redaction && redactionStatus === "complete" && (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-xs">Redacted PDF ready</span>
          </div>
        )}
      </div>

      {/* Summary summary */}
      <div
        className={`p-5 border-b border-gray-800 cursor-pointer transition-colors ${activeTab === "summary" ? "bg-gray-800/40" : "hover:bg-gray-800/20"}`}
        onClick={() => onTabChange(activeTab === "summary" ? null : "summary")}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlignLeft className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">Summary</p>
          </div>
          {activeTab === "summary" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
        </div>

        {!summary && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Not yet run</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-500 hover:text-gray-300 gap-1"
              onClick={(e) => { e.stopPropagation(); onRunAnalysis(); }}>
              <Play className="w-3 h-3" /> Run
            </Button>
          </div>
        )}
        {summary && (summaryStatus === "pending" || summaryStatus === "processing") && (
          <div className="flex items-center gap-2 text-amber-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">Generating…</span>
          </div>
        )}
        {summary && summaryStatus === "failed" && (
          <span className="text-xs text-red-400">Generation failed</span>
        )}
        {summary && summaryStatus === "complete" && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
            {summary.summary}
          </p>
        )}
      </div>

      {/* Security summary */}
      <div
        className={`p-5 cursor-pointer transition-colors ${activeTab === "security" ? "bg-gray-800/40" : "hover:bg-gray-800/20"}`}
        onClick={() => onTabChange(activeTab === "security" ? null : "security")}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">Security</p>
          </div>
          {activeTab === "security" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-xs">KMS encrypted</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Detail Panels ────────────────────────────────────────────────────────

function PiiDetailPanel({ pii, onRunAnalysis }) {
  if (!pii) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
        <Clock className="w-8 h-8" />
        <p className="text-sm">PII detection not yet run</p>
        <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={onRunAnalysis}>
          <Play className="w-3.5 h-3.5" /> Run Analysis
        </Button>
      </div>
    );
  }
  if (pii.status === "pending" || pii.status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-amber-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Running PII detection…</p>
        <p className="text-xs text-gray-600">This may take up to a minute</p>
      </div>
    );
  }
  if (pii.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-red-400">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">PII detection failed</p>
        <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={onRunAnalysis}>
          <Play className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pii.riskLevel === "none"
            ? <ShieldCheck className="w-4 h-4 text-emerald-400" />
            : <ShieldAlert className="w-4 h-4 text-amber-400" />
          }
          <span className="text-sm text-gray-400">
            {pii.entityCount} {pii.entityCount === 1 ? "entity" : "entities"} detected
          </span>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge level={pii.riskLevel} />
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-500 hover:text-gray-300 gap-1"
            onClick={onRunAnalysis}>
            <Play className="w-3 h-3" /> Re-run
          </Button>
        </div>
      </div>
      <Separator className="bg-gray-800" />
      {pii.entities?.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {pii.entities.map((entity, i) => (
            <div key={i} className="flex items-center justify-between rounded-md bg-gray-900 border border-gray-800 px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded shrink-0">
                  {entity.type}
                </span>
                <span className="text-sm text-gray-300 truncate">{entity.value}</span>
              </div>
              <span className="text-xs text-gray-500 shrink-0 ml-2">
                {(entity.confidence * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">No PII entities found</p>
      )}
      <p className="text-xs text-gray-600 pt-1">Scanned {pii.runAt} via Amazon Comprehend</p>
    </div>
  );
}

function RedactionDetailPanel({ redaction, redactedS3Url, piiComplete, onRunRedaction, showRedacted, onToggleRedacted }) {
  if (!piiComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
        <EyeOff className="w-8 h-8" />
        <p className="text-sm">PII detection must be complete before redaction</p>
      </div>
    );
  }
  if (!redaction) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
        <EyeOff className="w-8 h-8" />
        <p className="text-sm">Redaction not yet run</p>
        <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={onRunRedaction}>
          <Play className="w-3.5 h-3.5" /> Run Redaction
        </Button>
      </div>
    );
  }
  if (redaction.status === "pending" || redaction.status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-amber-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Generating redacted PDF…</p>
        <p className="text-xs text-gray-600">This may take a minute</p>
      </div>
    );
  }
  if (redaction.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-red-400">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">Redaction failed</p>
        <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={onRunRedaction}>
          <Play className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-gray-400">Redacted PDF ready</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={onToggleRedacted}
          >
            {showRedacted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showRedacted ? "View Original" : "View Redacted"}
          </Button>
          {redactedS3Url && (
            <a href={redactedS3Url} download>
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
            </a>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-500 hover:text-gray-300 gap-1"
            onClick={onRunRedaction}>
            <Play className="w-3 h-3" /> Re-run
          </Button>
        </div>
      </div>
      <Separator className="bg-gray-800" />
      <p className="text-xs text-gray-600">
        Completed {new Date(redaction.completedAt).toLocaleString()} · PII entities blacked out using Amazon Textract bounding boxes
      </p>
    </div>
  );
}

function SummaryDetailPanel({ summary, onRunAnalysis }) {
  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
        <Clock className="w-8 h-8" />
        <p className="text-sm">Summarization not yet run</p>
        <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={onRunAnalysis}>
          <Play className="w-3.5 h-3.5" /> Run Analysis
        </Button>
      </div>
    );
  }
  if (summary.status === "pending" || summary.status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-amber-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Generating summary…</p>
        <p className="text-xs text-gray-600">This may take up to a minute</p>
      </div>
    );
  }
  if (summary.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-red-400">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">Summarization failed</p>
        <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={onRunAnalysis}>
          <Play className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">AI-generated summary</span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-500 hover:text-gray-300 gap-1"
          onClick={onRunAnalysis}>
          <Play className="w-3 h-3" /> Re-run
        </Button>
      </div>
      <Separator className="bg-gray-800" />
      <p className="text-sm text-gray-300 leading-relaxed">{summary.summary}</p>
      <p className="text-xs text-gray-600 pt-1">
        Generated {new Date(summary.runAt).toLocaleString()} via Amazon Bedrock
      </p>
    </div>
  );
}

function SecurityDetailPanel({ doc }) {
  return (
    <div className="space-y-3 max-w-lg">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Encryption</span>
        <div className="flex items-center gap-1.5 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>KMS encrypted</span>
        </div>
      </div>
      <Separator className="bg-gray-800" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">File type</span>
        <span className="text-xs font-mono text-gray-400">{doc.fileType}</span>
      </div>
      <Separator className="bg-gray-800" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">File size</span>
        <span className="text-gray-400 text-xs">
          {doc.fileSize >= 1024 * 1024
            ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
            : `${(doc.fileSize / 1024).toFixed(1)} KB`}
        </span>
      </div>
      <Separator className="bg-gray-800" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Uploaded</span>
        <span className="text-gray-400 text-xs">
          {doc.uploadedAt
            ? new Date(doc.uploadedAt).toLocaleString()
            : doc.sortKey?.split("#")[1]
              ? new Date(doc.sortKey.split("#")[1]).toLocaleString()
              : "—"}
        </span>
      </div>
      <Separator className="bg-gray-800" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Access</span>
        <span className="text-xs text-gray-400">Signed URL (no public access)</span>
      </div>
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "pii",       label: "PII Detection", Icon: BarChart2 },
  { id: "redaction", label: "Redaction",     Icon: EyeOff    },
  { id: "summary",   label: "Summary",       Icon: AlignLeft },
  { id: "security",  label: "Security",      Icon: Shield    },
];

function TabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-800 px-6 bg-[#0d0d0f]">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(activeTab === id ? null : id)}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors -mb-px
            ${activeTab === id
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [showRedacted, setShowRedacted] = useState(false);

  const pollRef = useRef(null);
  const pollStartRef = useRef(null);
  const { user } = useAuth();

  const fetchDocument = async () => {
    const data = await api.getDocument(id, user.userId);
    setDoc(data);
    return data;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchDocument();
        if (data?.piiDetection?.status === "complete") setActiveTab("pii");
      } catch (err) {
        setError("Failed to load document.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  // Reset to original view if redaction is no longer complete
  useEffect(() => {
    if (doc?.redactionResults?.status !== "complete") {
      setShowRedacted(false);
    }
  }, [doc?.redactionResults?.status]);

  const startPolling = () => {
    setPolling(true);
    pollStartRef.current = Date.now();

    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > POLL_TIMEOUT_MS) {
        clearInterval(pollRef.current);
        setPolling(false);
        return;
      }
      try {
        const data = await fetchDocument();

        const isRedacting = data.redactionResults?.status === "pending" || 
                            data.redactionResults?.status === "processing";

        const redactionDone = data.redactionResults?.status === "complete" || 
                              data.redactionResults?.status === "failed";

        const docDone = (data.status === "complete" || data.status === "failed") && !isRedacting;

        if (docDone || redactionDone) {
          clearInterval(pollRef.current);
          setPolling(false);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, POLL_INTERVAL_MS);
  };

  const handleRunAnalysis = async (processingType) => {
    try {
      setSubmitting(true);
      await api.processDocument(id, user.userId, processingType);
      setModalOpen(false);
      setDoc((prev) => ({ ...prev, status: "processing" }));
      if (processingType === "pii") setActiveTab("pii");
      if (processingType === "summarization") setActiveTab("summary");
      startPolling();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunRedaction = async () => {
    try {
      setSubmitting(true);
      await api.processDocument(id, user.userId, "redaction");
      setDoc((prev) => ({
        ...prev,
        redactionResults: { status: "pending" },
      }));
      setActiveTab("redaction");
      startPolling();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!doc || !window.confirm(`Delete ${doc.fileName}? This cannot be undone.`)) return;
    try {
      setDeleting(true);
      await api.deleteDocument(id, user.userId, doc.sortKey);
      navigate(-1);
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  };

  // Determine which PDF URL to show
  const activePdfUrl = showRedacted && doc?.redactedS3Url ? doc.redactedS3Url : doc?.s3Url;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <p className="text-sm text-gray-500">{error ?? "Document not found."}</p>
      </div>
    );
  }

  const piiComplete = doc.piiDetection?.status === "complete";

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white gap-1.5 px-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <Separator orientation="vertical" className="h-5 bg-gray-700" />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-gray-500 shrink-0" />
          <h1 className="text-sm font-medium text-gray-200 truncate">{doc.fileName}</h1>
          <StatusBadge status={doc.status} />
          {polling && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />}
          {showRedacted && (
            <Badge variant="outline" className="text-xs font-medium bg-amber-900/40 text-amber-400 border-amber-700 shrink-0">
              Viewing Redacted
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-400 hover:bg-red-950/30 gap-1.5 px-2 shrink-0"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </header>

      {/* Top section: PDF viewer + sidebar */}
      <div className="flex" style={{ height: "calc(100vh - 57px - (var(--tab-panel-h, 0px)))" }}>

        {/* PDF viewer */}
        <div className="flex-1 flex flex-col border-r border-gray-800 overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4 bg-[#0d0d0f]">
            {activePdfUrl ? (
              doc.fileType?.startsWith("image/") ? (
                <img src={activePdfUrl} alt={doc.fileName} className="max-w-full rounded shadow-lg" />
              ) : (
                <Document
                  file={activePdfUrl}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  className="flex flex-col items-center gap-4"
                >
                  <Page
                    pageNumber={currentPage}
                    width={580}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
                <FileText className="w-12 h-12" />
                <p className="text-sm">Preview unavailable</p>
                <p className="text-xs text-gray-700">Signed URL will load here</p>
              </div>
            )}
          </div>

          {numPages && numPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-3 border-t border-gray-800 bg-[#0d0d0f] shrink-0">
              <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-400"
                disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-500">Page {currentPage} of {numPages}</span>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-400"
                disabled={currentPage >= numPages} onClick={() => setCurrentPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Key info sidebar */}
        <KeyInfoSidebar
          doc={doc}
          onRunAnalysis={() => setModalOpen(true)}
          onRunRedaction={handleRunRedaction}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Tab bar + detail panel */}
      <div className="border-t border-gray-800 shrink-0">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab && (
          <div className="px-8 py-6 border-t border-gray-800 bg-[#0d0d0f]">
            {activeTab === "pii" && (
              <PiiDetailPanel
                pii={doc.piiDetection ?? null}
                onRunAnalysis={() => setModalOpen(true)}
              />
            )}
            {activeTab === "redaction" && (
              <RedactionDetailPanel
                redaction={doc.redactionResults ?? null}
                redactedS3Url={doc.redactedS3Url ?? null}
                piiComplete={piiComplete}
                onRunRedaction={handleRunRedaction}
                showRedacted={showRedacted}
                onToggleRedacted={() => setShowRedacted((v) => !v)}
              />
            )}
            {activeTab === "summary" && (
              <SummaryDetailPanel
                summary={doc.summarizationResults ?? null}
                onRunAnalysis={() => setModalOpen(true)}
              />
            )}
            {activeTab === "security" && (
              <SecurityDetailPanel doc={doc} />
            )}
          </div>
        )}
      </div>

      <ProcessingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfirm={handleRunAnalysis}
        processing={submitting}
      />
    </div>
  );
}