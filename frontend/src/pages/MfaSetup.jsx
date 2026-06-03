import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { verifyTOTPSetup, confirmSignIn, updateMFAPreference } from "aws-amplify/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";

export default function MfaSetup() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { qrUrl, secret } = state ?? {};
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);

  useEffect(() => {
    if (!qrUrl) {
        setError("Setup details missing. Please sign in again.");
    }
    setSetupLoading(false);
    }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
        
        const { nextStep } = await confirmSignIn({ challengeResponse: code });
        console.log(nextStep.signInStep)
        if (nextStep.signInStep === "DONE") {
        navigate("/");
        }
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

        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white">Set up authenticator</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scan the QR code with Google Authenticator or Authy
          </p>
        </div>

        {setupLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        )}

        {!setupLoading && qrUrl && (
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="p-3 rounded-xl border border-gray-800 bg-gray-900">
              <img src={qrUrl} alt="TOTP QR Code" className="w-48 h-48" />
            </div>
            <details className="w-full">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 text-center transition-colors">
                Can't scan? Enter manually
              </summary>
              <p className="text-xs font-mono text-gray-400 mt-2 break-all text-center bg-gray-900 border border-gray-800 rounded-md px-3 py-2">
                {secret}
              </p>
            </details>
          </div>
        )}

        {!setupLoading && (
          <form onSubmit={handleVerify} className="space-y-3">
            <Input
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              autoComplete="one-time-code"
              className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 tracking-widest text-center text-lg focus:border-blue-600"
            />
            {error && (
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !qrUrl}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Verifying..." : "Confirm setup"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}