import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldAlert, ShieldCheck, Clock, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// --- Mock Data ---
const MOCK_DOCUMENT = {
  id: "doc-001",
  name: "Q3-financial-report.pdf",
  type: "report",
  status: "ready", // "pending" | "processing" | "ready"
  uploadedAt: "Apr 28, 2026",
  pageCount: 4,
  s3Url: null, // replace with signed URL
  piiDetection: {
    status: "complete", // "pending" | "running" | "complete"
    runAt: "Apr 28, 2026, 2:14 PM",
    entityCount: 3,
    riskLevel: "medium", // "none" | "low" | "medium" | "high"
    entities: [
      { type: "EMAIL", value: "j.smith@acme.com", confidence: 0.99 },
      { type: "PHONE", value: "(540) 555-0182", confidence: 0.97 },
      { type: "NAME", value: "Jonathan Smith", confidence: 0.94 },
    ],
  },
  security: {
    encrypted: true,
    kmsKeyId: "arn:aws:kms:us-east-1:123456789:key/abc-123",
    accessedBy: "user@example.com",
    lastAccessed: "May 14, 2026, 9:02 AM",
  },
};

// --- Sub-components ---

function StatusBadge({ status }) {
  const map = {
    pending:    { label: "Pending",    className: "bg-gray-800 text-gray-300 border-gray-700" },
    processing: { label: "Processing", className: "bg-amber-900/40 text-amber-400 border-amber-700" },
    ready:      { label: "Ready",      className: "bg-emerald-900/40 text-emerald-400 border-emerald-700" },
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

function PiiStatusPanel({ pii }) {
  if (pii.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
        <Clock className="w-8 h-8" />
        <p className="text-sm">PII detection queued</p>
      </div>
    );
  }

  if (pii.status === "running") {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-amber-400">
        <Clock className="w-8 h-8 animate-pulse" />
        <p className="text-sm">Running PII detection…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pii.riskLevel === "none" ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          )}
          <span className="text-sm text-gray-400">
            {pii.entityCount} {pii.entityCount === 1 ? "entity" : "entities"} detected
          </span>
        </div>
        <RiskBadge level={pii.riskLevel} />
      </div>

      <Separator className="bg-gray-800" />

      {pii.entities.length > 0 ? (
        <div className="space-y-2">
          {pii.entities.map((entity, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md bg-gray-900 border border-gray-800 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                  {entity.type}
                </span>
                <span className="text-sm text-gray-300">{entity.value}</span>
              </div>
              <span className="text-xs text-gray-500">
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

function SecurityPanel({ security }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Encryption</span>
        <div className="flex items-center gap-1.5 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>KMS encrypted</span>
        </div>
      </div>
      <Separator className="bg-gray-800" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">KMS Key</span>
        <span className="text-xs font-mono text-gray-400 truncate max-w-[180px]">
          {security.kmsKeyId.split("/").pop()}
        </span>
      </div>
      <Separator className="bg-gray-800" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Last accessed</span>
        <span className="text-gray-400 text-xs">{security.lastAccessed}</span>
      </div>
      <Separator className="bg-gray-800" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Accessed by</span>
        <span className="text-gray-400 text-xs">{security.accessedBy}</span>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = MOCK_DOCUMENT; // replace with API fetch by id

  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-gray-800">
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
          <h1 className="text-sm font-medium text-gray-200 truncate">{doc.name}</h1>
          <Badge variant="outline" className="text-xs border-gray-700 text-gray-400 shrink-0">
            {doc.type}
          </Badge>
          <StatusBadge status={doc.status} />
        </div>

        <span className="text-xs text-gray-600 shrink-0">Uploaded {doc.uploadedAt}</span>
      </header>

      {/* Split pane */}
      <div className="flex h-[calc(100vh-57px)]">

        {/* Left — PDF viewer */}
        <div className="flex-1 flex flex-col border-r border-gray-800 overflow-hidden">
          <div className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4 bg-[#111113]">
            {doc.s3Url ? (
              <Document
                file={doc.s3Url}
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
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
                <FileText className="w-12 h-12" />
                <p className="text-sm">PDF preview unavailable</p>
                <p className="text-xs text-gray-700">Signed URL will load here</p>
              </div>
            )}
          </div>

          {numPages && numPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-3 border-t border-gray-800 bg-[#0d0d0f]">
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-gray-400"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-500">
                Page {currentPage} of {numPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-gray-400"
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Right — Results panel */}
        <div className="w-[360px] shrink-0 flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-gray-800">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
              PII Detection
            </h2>
            <PiiStatusPanel pii={doc.piiDetection} />
          </div>

          <div className="p-5">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
              Security
            </h2>
            <SecurityPanel security={doc.security} />
          </div>
        </div>
      </div>
    </div>
  );
}