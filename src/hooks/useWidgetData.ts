import { useMemo } from "react";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useTasks } from "@/hooks/useTasks";
import { useEmails } from "@/hooks/useEmails";
import { usePhoneCalls } from "@/hooks/usePhoneCalls";
import { usePhoneMessages } from "@/hooks/usePhoneMessages";

/** Aggregated counts for today across calendar, tasks, emails, calls, and messages */
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

/** Aggregates today's activity counts across all systems for dashboard widgets and external integrations */
export function useWidgetData(): WidgetData {
  const dateKey = new Date().toDateString();

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateKey]);

  const todayEnd = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + 1);
    return d;
  }, [todayStart, dateKey]);

  const { data: todayEvents = [], isLoading: eventsLoading, isError: eventsError } = useCalendarEvents(
    todayStart,
    todayEnd,
  );
  const { data: todayTasks = [], isLoading: tasksLoading, isError: tasksError } = useTasks("today");
  const { data: overdueTasks = [], isLoading: overdueLoading } = useTasks("overdue");
  const { data: emails = [], isError: emailsError, isLoading: emailsLoading } = useEmails(
    "unread",
  );
  const { data: missedCalls = [], isError: callsError, isLoading: callsLoading } =
    usePhoneCalls("missed");
  const { data: unreadMessages = [], isError: messagesError, isLoading: messagesLoading } =
    usePhoneMessages("unread");

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
      error: eventsError || tasksError || emailsError || callsError || messagesError,
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
      eventsError,
      tasksError,
      emailsError,
      callsError,
      messagesError,
    ],
  );
}
