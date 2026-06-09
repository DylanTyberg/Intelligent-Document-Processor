// src/lib/tokens.js
export const classificationColor = {
  contract: "bg-classification-contract/10 text-classification-contract border-classification-contract/30",
  invoice: "bg-classification-invoice/10 text-classification-invoice border-classification-invoice/30",
  report: "bg-classification-report/10 text-classification-report border-classification-report/30",
  form: "bg-classification-form/10 text-classification-form border-classification-form/30",
  other: "bg-classification-other/10 text-classification-other border-classification-other/30",
};

export const piiSeverityColor = {
  high: "bg-pii-high/10 text-pii-high border-pii-high/30",
  medium: "bg-pii-medium/10 text-pii-medium border-pii-medium/30",
  low: "bg-pii-low/10 text-pii-low border-pii-low/30",
};

export const statusConfig = {
    pending: { label: "Pending", color: "text-status-pending", dot: "bg-status-pending" },
    processing: { label: "Processing", color: "text-status-processing", dot: "bg-status-processing animate-pulse" },
    complete: { label: "Ready", color: "text-status-success", dot: "bg-status-success" },
    failed: { label: "Failed", color: "text-status-error", dot: "bg-status-error" },
};