import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signUp, confirmSignUp } from "aws-amplify/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";

export default function SignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { nextStep } = await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        setStep("confirm");
      }
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
      await confirmSignUp({ username: email, confirmationCode: code });
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

        {step === "signup" && (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-white">Create account</h1>
              <p className="text-sm text-gray-500 mt-1">Get started with DocPlatform</p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-3">
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
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 focus:border-blue-600"
              />
              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full mt-1" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <p className="text-sm text-center mt-4 text-gray-600">
              Already have an account?{" "}
              <Link to="/signin" className="text-gray-400 hover:text-white transition-colors">
                Sign in
              </Link>
            </p>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-white">Check your email</h1>
              <p className="text-sm text-gray-500 mt-1">
                We sent a verification code to{" "}
                <span className="text-gray-300">{email}</span>
              </p>
            </div>

            <form onSubmit={handleConfirm} className="space-y-3">
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Verifying..." : "Verify email"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}