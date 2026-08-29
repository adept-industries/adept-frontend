import { RouterProvider } from "react-router/dom";
import { router } from "./router.js";
import { PRRiskPopup } from "../components/PRRiskPopup.js";

/**
 * App is the RouterProvider root.
 * Providers (QueryClient, AuthProvider) are mounted in main.tsx above this.
 */
export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <PRRiskPopup />
    </>
  );
}
