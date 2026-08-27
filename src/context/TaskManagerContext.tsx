import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

/**
 * Represents a background task in the application
 * 
 * @property {string} id - Unique identifier for the task
 * @property {string} name - Display name for the task
 * @property {string} category - Category for grouping related tasks
 * @property {number} progress - Completion percentage (0-100)
 * @property {string} progressText - Current status description
 * @property {'running'|'completed'|'error'} status - Current task state
 * @property {string[]} logs - Detailed operation log
 * @property {number} startTime - Timestamp when task was started
 * @property {string} [color] - Optional Tailwind gradient class for UI
 * @property {string} [tabId] - Optional associated tab ID for navigation
 */
export interface AppTask {
  id: string;
  name: string;
  category: string;
  progress: number;
  progressText: string;
  status: 'running' | 'completed' | 'error';
  logs: string[];
  startTime: number;
  color?: string;
  tabId?: string;
}

interface TaskManagerContextType {
  tasks: Record<string, AppTask>;
  startTask: (id: string, name: string, category: string, initialText?: string, tabId?: string, color?: string) => void;
  updateTask: (id: string, progress: number, progressText?: string, logLine?: string) => void;
  completeTask: (id: string, successText?: string) => void;
  failTask: (id: string, errorText?: string) => void;
  getTask: (id: string) => AppTask | undefined;
  activeTasks: AppTask[];
  dismissTask: (id: string) => void;
  subscribe: (callback: (tasks: AppTask[]) => void) => () => void;
}

const TaskManagerContext = createContext<TaskManagerContextType | undefined>(undefined);

export const TaskManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Record<string, AppTask>>({});
  const observersRef = useRef<Set<(tasks: AppTask[]) => void>>(new Set());

  useEffect(() => {
    const taskList = Object.values(tasks);
    observersRef.current.forEach(callback => callback(taskList));
  }, [tasks]);

  const subscribe = React.useCallback((callback: (tasks: AppTask[]) => void) => {
    observersRef.current.add(callback);
    return () => observersRef.current.delete(callback);
  }, []);

  const startTask = React.useCallback((id: string, name: string, category: string, initialText = 'Đang khởi tạo...', tabId?: string, color?: string) => {
    setTasks(prev => ({
      ...prev,
      [id]: {
        id,
        name,
        category,
        progress: 0,
        progressText: initialText,
        status: 'running',
        logs: [`[*] Bắt đầu tiến trình: ${name}`],
        startTime: Date.now(),
        color: color || 'from-emerald-500 to-teal-600',
        tabId
      }
    }));
  }, []);

  const updateTask = React.useCallback((id: string, progress: number, progressText?: string, logLine?: string) => {
    setTasks(prev => {
      const existing = prev[id];
      if (!existing) return prev;
      const newLogs = logLine ? [...existing.logs, logLine].slice(-200) : existing.logs;
      return {
        ...prev,
        [id]: {
          ...existing,
          progress: Math.min(100, Math.max(0, progress)),
          progressText: progressText !== undefined ? progressText : existing.progressText,
          logs: newLogs
        }
      };
    });
  }, []);

  const completeTask = React.useCallback((id: string, successText = 'Hoàn tất thành công!') => {
    setTasks(prev => {
      const existing = prev[id];
      if (!existing) return prev;
      return {
        ...prev,
        [id]: {
          ...existing,
          progress: 100,
          progressText: successText,
          status: 'completed',
          logs: [...existing.logs, `[+] ${successText}`].slice(-200)
        }
      };
    });
  }, []);

  const failTask = React.useCallback((id: string, errorText = 'Thất bại!') => {
    setTasks(prev => {
      const existing = prev[id];
      if (!existing) return prev;
      return {
        ...prev,
        [id]: {
          ...existing,
          status: 'error',
          progressText: errorText,
          logs: [...existing.logs, `[x] Lỗi: ${errorText}`].slice(-200)
        }
      };
    });
  }, []);

  const getTask = React.useCallback((id: string) => tasks[id], [tasks]);

  const dismissTask = React.useCallback((id: string) => {
    setTasks(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const activeTasks = React.useMemo(() => Object.values(tasks).filter((t: AppTask) => t.status === 'running'), [tasks]);

  const contextValue = React.useMemo(() => ({
    tasks,
    startTask,
    updateTask,
    completeTask,
    failTask,
    getTask,
    activeTasks,
    dismissTask,
    subscribe
  }), [tasks, startTask, updateTask, completeTask, failTask, getTask, activeTasks, dismissTask, subscribe]);

  return (
    <TaskManagerContext.Provider value={contextValue}>
      {children}
    </TaskManagerContext.Provider>
  );
};

export const useTaskManager = () => {
  const context = useContext(TaskManagerContext);
  if (!context) {
    throw new Error('useTaskManager must be used within a TaskManagerProvider');
  }
  return context;
};
