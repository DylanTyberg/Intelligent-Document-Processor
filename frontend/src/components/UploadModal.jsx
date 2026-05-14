import { useState, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const ACCEPTED_TYPES = {
    "application/pdf": [".pdf"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
};
const ACCEPTED_MIMES = Object.keys(ACCEPTED_TYPES);
const ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_TYPES).flat();
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const validateFile = (file) => {
    if (!ACCEPTED_MIMES.includes(file.type)) {
        return `File type not supported. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_SIZE_BYTES) {
        return `File too large. Max size is ${formatSize(MAX_SIZE_BYTES)}.`;
    }
    return null;
};

// Stub — replace with real upload flow later
const stubUpload = (file) =>
    new Promise((resolve) => {
        console.log("Uploading file:", file.name);
        setTimeout(resolve, 1500);
    });

const UploadModal = ({ open, onOpenChange, onUploadComplete }) => {
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState("idle"); // idle | uploading | success
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    const reset = () => {
        setFile(null);
        setError(null);
        setStatus("idle");
        setIsDragging(false);
    };

    const handleClose = (nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
    };

    const handleFile = useCallback((selected) => {
        setError(null);
        const validationError = validateFile(selected);
        if (validationError) {
            setError(validationError);
            return;
        }
        setFile(selected);
    }, []);

    const handleInputChange = (e) => {
        const selected = e.target.files?.[0];
        if (selected) handleFile(selected);
        // Reset input so the same file can be reselected after removal
        e.target.value = "";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) handleFile(dropped);
    };

    const handleSubmit = async () => {
        if (!file) return;
        setStatus("uploading");
        try {
            await stubUpload(file);
            setStatus("success");
            onUploadComplete?.(file);
            // Auto-close after brief success state
            setTimeout(() => handleClose(false), 1000);
        } catch (err) {
            setError("Upload failed. Please try again.");
            setStatus("idle");
        }
    };

    const isUploading = status === "uploading";
    const isSuccess = status === "success";

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload document</DialogTitle>
                    <DialogDescription>
                        PDF or image files, up to {formatSize(MAX_SIZE_BYTES)}.
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <div className="py-2">
                    {!file && (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => inputRef.current?.click()}
                            className={`flex flex-col items-center justify-center
                                        py-10 px-4 rounded-md border-2 border-dashed
                                        cursor-pointer transition-colors
                                        ${isDragging
                                            ? "border-ring bg-accent/50"
                                            : "border-border hover:border-ring hover:bg-accent/30"
                                        }`}
                        >
                            <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                            <p className="text-sm font-medium text-foreground mb-1">
                                Drop a file here or click to browse
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {ACCEPTED_EXTENSIONS.join(", ")}
                            </p>
                            <input
                                ref={inputRef}
                                type="file"
                                accept={ACCEPTED_MIMES.join(",")}
                                onChange={handleInputChange}
                                className="hidden"
                            />
                        </div>
                    )}

                    {file && !isSuccess && (
                        <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-card">
                            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate" title={file.name}>
                                    {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatSize(file.size)}
                                </p>
                            </div>
                            {!isUploading && (
                                <button
                                    onClick={() => setFile(null)}
                                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                                    aria-label="Remove file"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}

                    {isSuccess && (
                        <div className="flex items-center gap-2 p-3 rounded-md
                                        border border-status-success/30 bg-status-success/10">
                            <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
                            <p className="text-sm text-status-success">Upload complete</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 mt-3 p-3 rounded-md
                                        border border-status-error/30 bg-status-error/10">
                            <AlertCircle className="w-4 h-4 text-status-error shrink-0 mt-0.5" />
                            <p className="text-sm text-status-error">{error}</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => handleClose(false)}
                        disabled={isUploading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!file || isUploading || isSuccess}
                        className="min-w-28"
                    >
                        {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isUploading ? "Uploading..." : "Upload"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UploadModal;