import { createContext, useContext, useState, ReactNode } from "react";

interface InitializationContextType {
  isInitialized: boolean;
  setIsInitialized: (value: boolean) => void;
}

const InitializationContext = createContext<InitializationContextType | undefined>(undefined);

export const InitializationProvider = ({ children }: { children: ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  console.log("InitializationProvider: Rendered");

  return (
    <InitializationContext.Provider value={{ isInitialized, setIsInitialized }}>
      {children}
    </InitializationContext.Provider>
  );
};

export const useInitialization = () => {
  const context = useContext(InitializationContext);
  if (!context) {
    throw new Error("useInitialization must be used within an InitializationProvider");
  }
  return context;
};