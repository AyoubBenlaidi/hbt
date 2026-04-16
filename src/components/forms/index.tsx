import React from "react";
import { Button } from "@/components/ui";

interface FormProps {
  title: string;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  children: React.ReactNode;
}

export const Form: React.FC<FormProps> = ({ title, onSubmit, children }) => {
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
      <Button type="submit" disabled={loading}>
        {loading ? "Loading..." : "Submit"}
      </Button>
    </form>
  );
};
