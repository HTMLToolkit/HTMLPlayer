import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "./Tooltip";
import { SonnerToaster } from "./SonnerToaster";

const queryClient = new QueryClient();

export const GlobalContextProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <SonnerToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
};
