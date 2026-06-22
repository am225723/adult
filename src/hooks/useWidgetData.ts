import { useMemo } from "react";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useTasks } from "@/hooks/useTasks";
import { useEmails } from "@/hooks/useEmails";
import { usePhoneCalls } from "@/hooks/usePhoneCalls";
import { usePhoneMessages } from "@/hooks/usePhoneMessages";

export interface WidgetData {
  todayEventsCount: number;
  dueTodayTasksCount: number;
  overdueTasksCount: number;
  unreadEmailsCount: number;
  missedCallsCount: number;
  unreadMessagesCount: number;
  isLoading: boolean;
  error: boolean;
}

export function useWidgetData(): WidgetData {
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayEnd = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + 1);
    return d;
  }, [todayStart]);

  const { data: todayEvents = [], isLoading: eventsLoading } = useCalendarEvents(
    todayStart,
    todayEnd,
  );
  const { data: todayTasks = [], isLoading: tasksLoading } = useTasks("today");
  const { data: overdueTasks = [], isLoading: overdueLoading } = useTasks("overdue");
  const { data: emails = [], isError: emailsError, isLoading: emailsLoading } = useEmails(
    "unread",
  );
  const { data: allCalls = [], isError: callsError, isLoading: callsLoading } =
    usePhoneCalls("all");
  const { data: messages = [], isError: messagesError, isLoading: messagesLoading } =
    usePhoneMessages("all");

  const missedCalls = useMemo(
    () => allCalls.filter((c) => ["missed", "no-answer", "abandoned"].includes(c.status || "")),
    [allCalls],
  );

  const unreadMessages = useMemo(() => messages.filter((m) => !m.is_read), [messages]);

  return useMemo(
    () => ({
      todayEventsCount: todayEvents.length,
      dueTodayTasksCount: todayTasks.length,
      overdueTasksCount: overdueTasks.length,
      unreadEmailsCount: emails.length,
      missedCallsCount: missedCalls.length,
      unreadMessagesCount: unreadMessages.length,
      isLoading:
        eventsLoading ||
        tasksLoading ||
        overdueLoading ||
        emailsLoading ||
        callsLoading ||
        messagesLoading,
      error: emailsError || callsError || messagesError,
    }),
    [
      todayEvents.length,
      todayTasks.length,
      overdueTasks.length,
      emails.length,
      missedCalls.length,
      unreadMessages.length,
      eventsLoading,
      tasksLoading,
      overdueLoading,
      emailsLoading,
      callsLoading,
      messagesLoading,
      emailsError,
      callsError,
      messagesError,
    ],
  );
}
