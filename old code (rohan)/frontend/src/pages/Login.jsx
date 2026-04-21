import React from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  sendOtp,
  verifyOtp,
  selectAuthLoading,
  selectAuthError,
  selectOtpSent,
} from "../store/slices/Auth.slice.js";

// currentUser: null,
// loading: false,
// error: null,
// otpSent: false,
// otpEmail: null,

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const otpSent = useSelector(selectOtpSent);

  const [step, setStep] = React.useState("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState(["", "", "", "", "", ""]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    const resultAction = await dispatch(sendOtp(email.trim().toLowerCase()));

    if (sendOtp.fulfilled.match(resultAction)) {
      setStep("otp");
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();

    if (!/^\d{6}$/.test(pasteData)) return;

    setOtp(pasteData.split(""));
    document.getElementById("otp-5")?.focus();
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join("");

    if (code.length !== 6) {
      alert("Please enter a valid 6-digit code");
      return;
    }

    const resultAction = await dispatch(
      verifyOtp({
        email: email.trim().toLowerCase(),
        otp: code,
      }),
    );

    if (verifyOtp.fulfilled.match(resultAction)) {
      navigate("/dashboard");
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setOtp(["", "", "", "", "", ""]);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <header className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <Shield className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold text-on-surface">PayGate</h1>
      </header>

      <main className="w-full max-w-md">
        <div className="rounded-default border border-outline-variant/10 bg-surface-container-lowest p-8 md:p-10">
          {step === "email" ? (
            <>
              <div className="mb-8 text-center">
                <h2 className="mb-2 text-2xl font-bold text-on-surface">
                  Welcome back
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Sign in to your settlement dashboard
                </p>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-on-surface">
                    Email address
                  </label>

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Sending..." : "Continue"}
                </button>
              </form>

              {/* <div className="mt-8 text-center text-xs text-on-surface-variant">
                Demo emails: admin@paygate.com · merchant1@techflow.com
              </div> */}
            </>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h2 className="mb-2 text-2xl font-bold text-on-surface">
                  Enter verification code
                </h2>
                <p className="text-sm text-on-surface-variant">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-on-surface">{email}</span>
                </p>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div
                  className="flex justify-center gap-2"
                  onPaste={handlePaste}
                >
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="h-14 w-12 rounded-lg border border-outline-variant/20 bg-surface-container-low text-center text-xl font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-center text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-primary py-3 font-semibold text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Verifying..." : "Verify & Sign in"}
                </button>
              </form>

              <div className="mt-6 space-y-2 text-center">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="text-sm text-on-surface-variant hover:text-on-surface"
                >
                  Use a different email
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
