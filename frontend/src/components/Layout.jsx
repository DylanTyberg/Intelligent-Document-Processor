import { Outlet, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const Layout = () => {
    const navigate = useNavigate();
    const { user, loading, logout } = useAuth();

    const handleSignOut = async () => {
        await logout();
        navigate("/signin");
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                    <Link to="/" className="font-semibold text-lg">
                        DocPlatform
                    </Link>
                    <div className="flex items-center gap-3">
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                        ) : user ? (
                            <>
                                <span className="text-sm text-gray-500">{user.signInDetails?.loginId}</span>
                                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                                    Sign out
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" onClick={() => navigate("/signin")}>
                                    Sign in
                                </Button>
                                <Button size="sm" onClick={() => navigate("/signup")}>
                                    Sign up
                                </Button>
                            </>
                        )}
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