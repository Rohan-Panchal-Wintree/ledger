import { useEffect } from "react";
import "./App.css";
import { DashboardLayout } from "./layout/DashboardLayout.jsx";
import { useDispatch } from "react-redux";
import { getUserFromStorage } from "./store/slices/Auth.slice.js";

function App() {
  return (
    <>
      <DashboardLayout />
    </>
  );
}

export default App;
