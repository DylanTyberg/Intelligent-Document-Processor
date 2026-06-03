import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { resetPassword, confirmResetPassword } from "aws-amplify/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword({ username: email });
      setStep("confirm");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
      navigate("/signin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="flex justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {step === "request" && (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-white">Reset password</h1>
              <p className="text-sm text-gray-500 mt-1">
                We'll send a reset code to your email
              </p>
            </div>

            <form onSubmit={handleRequest} className="space-y-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 focus:border-blue-600"
              />
              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full mt-1" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Sending..." : "Send reset code"}
              </Button>
            </form>

            <p className="text-sm text-center mt-4">
              <Link to="/signin" className="text-gray-600 hover:text-gray-300 transition-colors">
                Back to sign in
              </Link>
            </p>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-white">Set new password</h1>
              <p className="text-sm text-gray-500 mt-1">
                Enter the code sent to{" "}
                <span className="text-gray-300">{email}</span>
              </p>
            </div>

            <form onSubmit={handleConfirm} className="space-y-3">
              <Input
                type="text"
                placeholder="Reset code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                autoComplete="one-time-code"
                className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 tracking-widest text-center text-lg focus:border-blue-600"
              />
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 focus:border-blue-600"
              />
              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}