"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CollapsibleSection({ 
  title, 
  icon: Icon, 
  defaultOpen = true, 
  children 
}: { 
  title: string; 
  icon: any; 
  defaultOpen?: boolean; 
  children: React.ReactNode 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="rounded-xl border-2 border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-blue-600" />
          <span className="font-bold text-foreground">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 pt-0 space-y-4 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
