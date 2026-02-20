import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MyDayService } from './my-day.service';
import { MyDayDto, MyDayTaskDto } from './my-day.models';

interface MyDayState {
  data: MyDayDto | null;
  isLoading: boolean;
  error: string | null;
  completingTaskIds: string[];
  highlightedItemId: string | null;
}

const initialState: MyDayState = {
  data: null,
  isLoading: false,
  error: null,
  completingTaskIds: [],
  highlightedItemId: null,
};

/**
 * My Day signal store — component-provided (NOT root).
 * Manages all dashboard widget data, optimistic task completion, and UI state.
 */
export const MyDayStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    /** Overdue tasks filtered from the full tasks list. */
    overdueTasks: computed(() => {
      const data = store.data();
      if (!data) return [];
      return data.tasks.filter((t) => t.isOverdue);
    }),
    /** Today's tasks (not overdue) filtered from the full tasks list. */
    todayTasks: computed(() => {
      const data = store.data();
      if (!data) return [];
      return data.tasks.filter((t) => !t.isOverdue);
    }),
    /** Summary stats for the greeting banner. */
    greetingStats: computed(() => {
      const data = store.data();
      return {
        tasksToday: data?.tasksTodayCount ?? 0,
        overdue: data?.overdueCount ?? 0,
        meetings: data?.upcomingMeetingsCount ?? 0,
      };
    }),
  })),
  withMethods((store) => {
    const service = inject(MyDayService);
    const snackBar = inject(MatSnackBar);

    return {
      /** Load all My Day widget data from the API. */
      loadMyDay(): void {
        patchState(store, { isLoading: true, error: null });
        service.getMyDay().subscribe({
          next: (data) => {
            patchState(store, { data, isLoading: false });
          },
          error: (err) => {
            const message = err?.message ?? 'Failed to load My Day data';
            patchState(store, { error: message, isLoading: false });
          },
        });
      },

      /**
       * Complete a task with optimistic update.
       * Immediately removes the task from the list, reverts on error.
       */
      completeTask(taskId: string): void {
        const data = store.data();
        if (!data) return;

        // Save original task for potential revert
        const originalTask = data.tasks.find((t) => t.id === taskId);
        if (!originalTask) return;

        // Optimistic: remove task from list, add to completing set
        const updatedTasks = data.tasks.filter((t) => t.id !== taskId);
        patchState(store, {
          data: { ...data, tasks: updatedTasks },
          completingTaskIds: [...store.completingTaskIds(), taskId],
        });

        service.completeTask(taskId).subscribe({
          next: () => {
            // Success: update counts, remove from completing set
            const currentData = store.data();
            if (currentData) {
              const newData = {
                ...currentData,
                tasksTodayCount: originalTask.isOverdue
                  ? currentData.tasksTodayCount
                  : Math.max(0, currentData.tasksTodayCount - 1),
                overdueCount: originalTask.isOverdue
                  ? Math.max(0, currentData.overdueCount - 1)
                  : currentData.overdueCount,
              };
              patchState(store, {
                data: newData,
                completingTaskIds: store.completingTaskIds().filter((id) => id !== taskId),
              });
            }
          },
          error: () => {
            // Revert: re-add the task to the list
            const currentData = store.data();
            if (currentData) {
              const revertedTasks = [...currentData.tasks, originalTask].sort(
                (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
              );
              patchState(store, {
                data: { ...currentData, tasks: revertedTasks },
                completingTaskIds: store.completingTaskIds().filter((id) => id !== taskId),
              });
            }
            snackBar.open('Failed to complete task. Please try again.', 'Dismiss', {
              duration: 4000,
            });
          },
        });
      },

      /** Refresh all dashboard data (used after quick actions). */
      refreshData(): void {
        this.loadMyDay();
      },

      /** Briefly highlight an item (pulse animation for 2 seconds). */
      setHighlight(id: string): void {
        patchState(store, { highlightedItemId: id });
        setTimeout(() => {
          patchState(store, { highlightedItemId: null });
        }, 2000);
      },
    };
  })
);
