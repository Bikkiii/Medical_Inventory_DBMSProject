import { useContext } from "react";
import AuthCtx from "../context/authContextValue";

export function useAuth() {
  return useContext(AuthCtx);
}
