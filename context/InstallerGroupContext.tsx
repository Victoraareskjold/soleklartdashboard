"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface InstallerGroupContextType {
  installerGroupId: string | null;
  setInstallerGroupId: (id: string | null) => void;
}

const InstallerGroupContext = createContext<
  InstallerGroupContextType | undefined
>(undefined);

export const InstallerGroupProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [installerGroupId, setInstallerGroupId] = useState<string | null>(null);

  return (
    <InstallerGroupContext.Provider
      value={{ installerGroupId, setInstallerGroupId }}
    >
      {children}
    </InstallerGroupContext.Provider>
  );
};

export const useInstallerGroup = () => {
  const context = useContext(InstallerGroupContext);
  if (!context) {
    throw new Error(
      "useInstallerGroup must be used within an InstallerGroupProvider"
    );
  }
  return context;
};
