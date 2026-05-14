import { Outlet, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Layout = () => {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                    <Link to="/" className="font-semibold text-lg">
                        DocPlatform
                    </Link>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm">
                            Sign in
                        </Button>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;