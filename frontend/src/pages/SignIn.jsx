import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn, confirmSignIn } from "aws-amplify/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";

export default function SignIn() {
  const navigate = useNavigate();
  const [step, setStep] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { nextStep } = await signIn({ username: email, password });
      console.log(nextStep)
      if (nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") {
        setStep("mfa");
      } else if (nextStep.signInStep === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
            const uri = nextStep.totpSetupDetails.getSetupUri("DocPlatform");
            const qrUrl = await QRCode.toDataURL(uri.toString(), {
            color: { dark: "#ffffff", light: "#111111" },
            width: 200,
            margin: 2,
            });

            navigate("/mfa-setup", {
            state: {
                qrUrl,
                secret: nextStep.totpSetupDetails.sharedSecret,
            }
            });
      } else if (nextStep.signInStep === "DONE") {
        navigate("/");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { nextStep } = await confirmSignIn({ challengeResponse: totpCode });
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

        {/* Logo mark */}
        <div className="flex justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {step === "signin" && (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-white">Welcome back</h1>
              <p className="text-sm text-gray-500 mt-1">Sign in to DocPlatform</p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 focus:border-blue-600"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 focus:border-blue-600"
              />

              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full mt-1" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="flex items-center justify-between mt-4 text-sm">
              <Link to="/forgot-password" className="text-gray-600 hover:text-gray-300 transition-colors">
                Forgot password?
              </Link>
              <Link to="/signup" className="text-gray-600 hover:text-gray-300 transition-colors">
                Create account
              </Link>
            </div>
          </>
        )}

        {step === "mfa" && (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-white">Two-factor auth</h1>
              <p className="text-sm text-gray-500 mt-1">Enter the code from your authenticator app</p>
            </div>

            <form onSubmit={handleMfa} className="space-y-3">
              <Input
                type="text"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                maxLength={6}
                autoComplete="one-time-code"
                className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 tracking-widest text-center text-lg focus:border-blue-600"
              />
              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}