import { useNavigate } from "react-router-dom";

function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-center px-4">
      403 Forbidden
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Access Denied</h1>
      <p className="text-gray-600 mb-6 max-w-md">
        You don’t have permission to view this page. Please check your access
        rights or return to a safe page.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-lg bg-[#3b52d9] text-white hover:bg-[#3245b8] cursor-pointer transition"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}

export default Unauthorized;
