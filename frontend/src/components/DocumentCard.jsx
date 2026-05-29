import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { classificationColor, statusConfig } from "@/lib/tokens";

const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const DocumentCard = ({ document }) => {
    const status = statusConfig[document.status] ?? statusConfig.pending;
    const classification = document.classification ?? "other";
    const documentId = document.sortKey.split("#")[1];

    return (
        <Link
            to={`/documents/${documentId}`}
            className="group block rounded-md border border-border bg-card p-4
                       hover:border-ring hover:bg-accent/50 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-ring"
        >
            {/* Top: filename with icon */}
            <div className="flex items-start gap-2 mb-3">
                <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <h3 className="text-sm font-medium text-foreground truncate" title={document.fileName}>
                    {document.fileName}
                </h3>
            </div>

            {/* Middle: classification + status badges */}
            <div className="flex items-center gap-2 mb-4">
                <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                                ${classificationColor[classification]}`}
                >
                    {classification}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs ${status.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                </span>
            </div>

            {/* Bottom: metadata */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(document.uploadedAt)}</span>
                <span>
                    {document.analysisCount} {document.analysisCount === 1 ? "analysis" : "analyses"}
                </span>
            </div>
        </Link>
    );
};

export default DocumentCard;