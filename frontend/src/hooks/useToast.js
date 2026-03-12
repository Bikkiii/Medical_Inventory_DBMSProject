import { useContext } from "react";
import ToastCtx from "../context/toastContextValue";

export function useToast() {
  return useContext(ToastCtx);
}
