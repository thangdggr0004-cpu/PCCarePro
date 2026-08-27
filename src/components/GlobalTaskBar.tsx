import React, { useState, useEffect } from 'react';
import { useTaskManager, AppTask } from '../context/TaskManagerContext.js';
import { Activity, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, X, Terminal } from 'lucide-react';

interface GlobalTaskBarProps {
  onNavigateTab?: (tabId: string) => void;
}

export default function GlobalTaskBar({ onNavigateTab }: GlobalTaskBarProps) {
  const { tasks, activeTasks, dismissTask, subscribe } = useTaskManager();
  const [_, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, [subscribe]);
  const allTasksList: AppTask[] = Object.values(tasks);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (allTasksList.length === 0) return null;

  const expandedTask = expandedTaskId ? tasks[expandedTaskId] : null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 max-w-md w-full sm:w-[420px] pointer-events-auto font-sans animate-fade-in">
      
      {/* EXPANDED LOG DRAWER */}
      {expandedTask && (
        <div className="w-full bg-slate-900/95 text-slate-100 rounded-xl border border-slate-700/80 shadow-2xl p-4 space-y-3 backdrop-blur-md transition-all">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">{expandedTask.name}</span>
            </div>
            <button 
              onClick={() => setExpandedTaskId(null)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar in drawer */}
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between text-[11px]">
              <span className="text-emerald-400 font-semibold">{expandedTask.progressText}</span>
              <span className="text-slate-300 font-bold">{expandedTask.progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${expandedTask.progress}%` }}
              />
            </div>
          </div>

          {/* Terminal Output */}
          <div className="bg-slate-950/80 rounded-lg p-2.5 font-mono text-[11px] max-h-36 overflow-y-auto space-y-1 text-slate-300 border border-slate-800/80 shadow-inner scrollbar-thin">
            {expandedTask.logs.map((log, idx) => (
              <div key={idx} className="leading-tight break-all">
                {log}
              </div>
            ))}
          </div>

          {expandedTask.tabId && onNavigateTab && (
            <button
              onClick={() => {
                if (expandedTask.tabId) onNavigateTab(expandedTask.tabId);
                setExpandedTaskId(null);
              }}
              className="w-full py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              Chuyển đến tab {expandedTask.category} ➔
            </button>
          )}
        </div>
      )}

      {/* COMPACT TASK CHIPS LIST */}
      <div className="w-full space-y-2">
        {allTasksList.map((task) => {
          const isRunning = task.status === 'running';
          const isDone = task.status === 'completed';
          const isError = task.status === 'error';

          return (
            <div
              key={task.id}
              className={`w-full bg-slate-900/90 hover:bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-700/80 shadow-xl backdrop-blur-md flex items-center justify-between gap-3 transition-all duration-300`}
            >
              <div 
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
              >
                {/* Icon Status */}
                <div className="shrink-0">
                  {isRunning && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-emerald-400 animate-spin" />
                    </div>
                  )}
                  {isDone && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                  {isError && (
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold gap-2">
                    <span className="truncate text-slate-200">{task.name}</span>
                    <span className="font-mono text-emerald-400 text-[11px] shrink-0 font-extrabold">{task.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                    <span className="truncate text-slate-400">{task.progressText}</span>
                    <span className="text-slate-500 ml-2 shrink-0">[{task.category}]</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
                  title="Xem nhật ký chi tiết"
                >
                  <ChevronUp className={`w-4 h-4 transition-transform ${expandedTaskId === task.id ? 'rotate-180' : ''}`} />
                </button>
                
                {!isRunning && (
                  <button
                    onClick={() => dismissTask(task.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                    title="Đóng thông báo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
