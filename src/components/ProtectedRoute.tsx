import { Navigate } from "react-router-dom";
import { HumanType } from "../types/HumanType";

function ProtectedRoute({ user, children }: { user: HumanType | null; children: JSX.Element }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default ProtectedRoute;
