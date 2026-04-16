import React from "react";
import { GlobalLayout } from "@/components/layout/GlobalLayout";

export const metadata = {
  title: "Dashboard - HBT",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GlobalLayout>
      {children}
    </GlobalLayout>
  );
}
