import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = React.useState("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState(["", "", "", "", "", ""]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();

    if (!email.trim()) return;

    setStep("otp");
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

  const getUserDataFromEmail = (userEmail) => {
    const normalizedEmail = userEmail.trim().toLowerCase();

    if (normalizedEmail === "admin@paygate.com") {
      return {
        role: "admin",
        merchantMid: null,
      };
    }

    return {
      role: "merchant",
      merchantMid: "MID123456",
    };
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    const code = otp.join("");

    if (code.length !== 6) {
      alert("Please enter a valid 6-digit code");
      return;
    }

    const userData = getUserDataFromEmail(email);

    login(email.trim().toLowerCase(), userData.role, userData.merchantMid);
    navigate("/dashboard");
  };

  const handleBackToEmail = () => {
    setStep("email");
    setOtp(["", "", "", "", "", ""]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 font-sans">
      <header className="mb-10 flex items-center gap-2">
        <div className="rounded-lg bg-[#3b52d9] p-2">
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">PayGate</h1>
      </header>

      <main className="w-full max-w-120">
        <div
          className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm md:p-12"
          style={{
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          }}
        >
          {step === "email" ? (
            <>
              <div className="mb-8 text-center">
                <h2 className="mb-2 text-2xl font-bold text-gray-900">
                  Welcome back
                </h2>
                <p className="text-sm text-gray-500">
                  Sign in to your settlement dashboard
                </p>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-gray-900"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3b52d9] px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-[#3245b8]"
                >
                  <span>Continue</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-xs leading-relaxed text-gray-400">
                  Demo emails: admin@paygate.com · merchant1@techflow.com
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h2 className="mb-2 text-2xl font-bold text-gray-900">
                  Enter verification code
                </h2>
                <p className="text-sm text-gray-500">
                  We sent a 6-digit code to{" "}
                  <span className="text-gray-600">{email}</span>
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
                      inputMode="numeric"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="h-14 w-12 rounded-md border border-gray-200 text-center text-xl text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#3b52d9] py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-[#3245b8]"
                >
                  Verify & Sign in
                </button>
              </form>

              <div className="mt-6 space-y-3 text-center">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="block w-full text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  Use a different email
                </button>
                <p className="text-xs text-gray-400">
                  Demo: enter any 6 digits
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
