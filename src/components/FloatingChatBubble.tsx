import { useState } from "react";
import { MessageSquare, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamChat } from "@/components/TeamChat";
import { useChatThreads } from "@/hooks/useChatThreads";

export function FloatingChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const { data: threads = [] } = useChatThreads();

  const unreadCount = threads.reduce((sum, thread) => {
    return sum + (thread.unread_count ?? 0);
  }, 0);

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center z-40 md:bottom-8 md:right-8"
        title="Open team chat"
      >
        <div className="relative">
          <MessageSquare size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-card border border-border rounded-xl shadow-2xl flex flex-col z-40 md:bottom-8 md:right-8 max-h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">Team Chat</h3>
          {unreadCount > 0 && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            <ChevronDown size={14} className={cn(isMinimized && "rotate-180")} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="flex-1 overflow-hidden">
          <TeamChat />
        </div>
      )}
    </div>
  );
}
