import { useNavigate } from "react-router-dom";
import { ShieldX } from "lucide-react";

function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-8 text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low">
            <ShieldX className="h-6 w-6 text-primary" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-2 text-3xl font-extrabold text-on-surface">
          Access Denied
        </h1>

        {/* Subtitle */}
        <p className="mb-1 text-sm font-semibold text-on-surface-variant">
          403 Forbidden
        </p>

        {/* Description */}
        <p className="mb-6 text-sm text-on-surface-variant">
          You don’t have permission to view this page. Please check your access
          rights or return to a safe page.
        </p>

        {/* Button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-container"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

export default Unauthorized;
