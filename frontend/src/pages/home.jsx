import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import DocumentCard from "@/components/DocumentCard";
import UploadModal from "@/components/UploadModal";

// Temporary mock data — delete when API is wired
const mockDocuments = [
    {
        id: "doc_1",
        filename: "Q3-financial-report.pdf",
        classification: "report",
        status: "completed",
        uploadedAt: "2026-04-28T14:32:00Z",
        analysisCount: 3,
    },
    {
        id: "doc_2",
        filename: "service-agreement-acme.pdf",
        classification: "contract",
        status: "processing",
        uploadedAt: "2026-05-01T09:15:00Z",
        analysisCount: 1,
    },
    {
        id: "doc_3",
        filename: "invoice-2026-04.pdf",
        classification: "invoice",
        status: "pending",
        uploadedAt: "2026-05-02T16:00:00Z",
        analysisCount: 0,
    },
];

const Home = () => {
    const [docFilterString, setDocFilterString] = useState("");
    const [uploadOpen, setUploadOpen] = useState(false);
    const documents = mockDocuments;

    const handleUploadComplete = (documentId) => {
        console.log("Refresh document list", documentId);
        // Later: refetch documents, or optimistically add a pending card
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Input
                    type="text"
                    placeholder="Search documents..."
                    value={docFilterString}
                    onChange={(e) => setDocFilterString(e.target.value)}
                    className="flex-1"
                />
                <Button size="lg" className="min-w-32" onClick={() => setUploadOpen(true)}>
                    <Upload className="w-4 h-4" />
                    Upload
                </Button>
            </div>

            

            <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
                {documents.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center
                                    py-16 text-center border border-dashed border-border rounded-md">
                        <p className="text-sm text-muted-foreground">
                            No documents yet. Upload one to get started.
                        </p>
                    </div>
                ) : (
                    documents.filter(document => document.filename.includes(docFilterString)).map((doc) => <DocumentCard key={doc.id} document={doc} />)
                )}
            </div>

             <UploadModal
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onUploadComplete={handleUploadComplete}
            />
        </div>
    );
};

export default Home;