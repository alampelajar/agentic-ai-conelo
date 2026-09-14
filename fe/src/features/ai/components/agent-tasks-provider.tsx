import { createContext, useContext, useState } from "react";

export type AgentTaskStatus =
  | "todo"
  | "in progress"
  | "done"
  | "canceled"
  | "backlog";

export type AgentTaskPriority = "low" | "medium" | "high";

export type AgentTaskLabel = "bug" | "feature" | "documentation";

export type AgentTask = {
  id: string;
  title: string;
  status: AgentTaskStatus;
  label: AgentTaskLabel;
  priority: AgentTaskPriority;
  description: string;
};

type AgentTasksContextType = {
  tasks: AgentTask[];
  addTasks: (newTasks: AgentTask[]) => void;
  updateTaskStatus: (taskId: string, status: AgentTaskStatus) => void;
  clearTasks: () => void;
};

const AgentTasksContext = createContext<AgentTasksContextType | undefined>(
  undefined,
);

const initialTasks: AgentTask[] = [];

export function AgentTasksProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tasks, setTasks] = useState<AgentTask[]>(initialTasks);

  const addTasks = (newTasks: AgentTask[]) => {
    setTasks((current) => {
      const existingIds = new Set(current.map((task) => task.id));

      const uniqueTasks = newTasks.filter((task) => !existingIds.has(task.id));

      return [...current, ...uniqueTasks];
    });
  };

  const updateTaskStatus = (taskId: string, status: AgentTaskStatus) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
            }
          : task,
      ),
    );
  };

  const clearTasks = () => {
    setTasks([]);
  };

  return (
    <AgentTasksContext.Provider
      value={{
        tasks,
        addTasks,
        updateTaskStatus,
        clearTasks,
      }}
    >
      {children}
    </AgentTasksContext.Provider>
  );
}

export function useAgentTasks() {
  const context = useContext(AgentTasksContext);

  if (!context) {
    throw new Error("useAgentTasks must be used inside AgentTasksProvider");
  }

  return context;
}
