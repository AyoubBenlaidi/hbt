"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { spacing } from "@/lib/designSystem";

const NewExpenseContent = dynamic(() => import("./NewExpenseContent"), { ssr: false });

export default function NewExpensePage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: spacing.xl, textAlign: "center" }}>Loading...</div>}>
      <NewExpenseContent />
    </Suspense>
  );
}
