import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "@/App.tsx";
// Internal components
// import { Toaster } from "@/public/components/ui/toaster";
// import { WalletProvider } from "@/public/components/WalletProvider";
// import { WrongNetworkAlert } from "@/public/components/WrongNetworkAlert";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    
     
        <App />
       
  </React.StrictMode>,
);
