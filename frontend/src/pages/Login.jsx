import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  clearAuthError,
  sendOtp,
  verifyOtp,
  selectAuthLoading,
  selectAuthError,
  selectCurrentUser,
} from "../store/slices/Auth.slice.js";

import Button from "../component/UI/Button";
import FormField from "../component/UI/FormField";

const OTP_LENGTH = 6;
const emptyOtp = Array.from({ length: OTP_LENGTH }, () => "");

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const currentUser = useSelector(selectCurrentUser);

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(emptyOtp);

  const otpInputRefs = useRef([]);

  const normalizedEmail = normalizeEmail(email);
  const otpCode = otp.join("");
  const isOtpComplete = otpCode.length === OTP_LENGTH;

  useEffect(() => {
    if (currentUser?.email) {
      navigate("/dashboard", { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch, step]);

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

    if (!normalizedEmail) return;

    const resultAction = await dispatch(sendOtp(normalizedEmail));

    if (sendOtp.fulfilled.match(resultAction)) {
      setStep("otp");
      setOtp(emptyOtp);

      window.requestAnimationFrame(() => {
        otpInputRefs.current[0]?.focus();
      });
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;

    setOtp((prevOtp) => {
      const nextOtp = [...prevOtp];
      nextOtp[index] = value;
      return nextOtp;
    });

    if (value && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();

    const pastedCode = event.clipboardData.getData("text").trim();

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(pastedCode)) return;

    setOtp(pastedCode.split(""));

    window.requestAnimationFrame(() => {
      otpInputRefs.current[OTP_LENGTH - 1]?.focus();
    });
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();

    if (!isOtpComplete) {
      toast.error("Please enter a valid 6-digit code.");
      return;
    }

    const resultAction = await dispatch(
      verifyOtp({
        email: normalizedEmail,
        otp: otpCode,
      }),
    );

    if (verifyOtp.fulfilled.match(resultAction)) {
      navigate("/dashboard", { replace: true });
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setOtp(emptyOtp);
    dispatch(clearAuthError());
  };

  return (
    <div className="min-h-screen bg-surface-container-low text-on-background">
      <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="flex min-h-screen items-center justify-center bg-surface-container-lowest px-6 py-10 md:px-12">
          <div className="w-full max-w-md">
            <header className="mb-10 flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
                <Shield className="h-5 w-5" />
              </div>

              <h1 className="text-2xl font-semibold text-on-surface">
                PayGate
              </h1>
            </header>

            <div className="rounded-default border border-outline-variant/10 bg-white p-8 md:p-10">
              {step === "email" ? (
                <>
                  <div className="mb-8 text-center">
                    <h2 className="mb-2 text-2xl font-bold text-on-surface">
                      Welcome back
                    </h2>

                    <p className="text-sm text-on-surface-variant">
                      Sign in to your settlement dashboard.
                    </p>
                  </div>

                  <form onSubmit={handleEmailSubmit} className="space-y-6">
                    <FormField label="Email address" required>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@company.com"
                        className="form-input rounded-full mb-2"
                      />
                    </FormField>

                    {error ? (
                      <p className="text-sm font-medium text-error">{error}</p>
                    ) : null}

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      rounded="full"
                      loading={loading}
                      disabled={loading || !normalizedEmail}
                      className="w-full"
                    >
                      Continue
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-8 text-center">
                    <h2 className="mb-2 text-2xl font-bold text-on-surface">
                      Enter verification code
                    </h2>

                    <p className="text-sm text-on-surface-variant">
                      We sent a 6-digit code to{" "}
                      <span className="font-medium text-on-surface">
                        {normalizedEmail}
                      </span>
                    </p>
                  </div>

                  <form onSubmit={handleOtpSubmit} className="space-y-6">
                    <div
                      className="flex justify-center gap-2"
                      onPaste={handleOtpPaste}
                    >
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(element) => {
                            otpInputRefs.current[index] = element;
                          }}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={1}
                          value={digit}
                          onChange={(event) =>
                            handleOtpChange(index, event.target.value)
                          }
                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                          className={`h-14 w-12 rounded-lg border bg-surface-container-low text-center text-xl font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 ${
                            digit
                              ? "border-primary"
                              : "border-outline-variant/20"
                          }`}
                        />
                      ))}
                    </div>

                    {error ? (
                      <p className="text-center text-sm font-medium text-error">
                        {error}
                      </p>
                    ) : null}

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      rounded="full"
                      loading={loading}
                      disabled={loading || !isOtpComplete}
                      className="w-full"
                    >
                      Verify & Sign in
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleBackToEmail}
                      disabled={loading}
                    >
                      Use a different email
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="hidden min-h-screen bg-white lg:block">
          <div className="h-full overflow-hidden bg-surface-container-lowest">
            <img
              src={step === "email" ? "assets/email.png" : "assets/otp.png"}
              alt={step === "email" ? "Login illustration" : "OTP illustration"}
              className="h-full w-full object-cover"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
