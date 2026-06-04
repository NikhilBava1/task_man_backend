import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { rateLimit } from "express-rate-limit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: process.env.NODE_ENV === "production" ? (process.env.ALLOWED_ORIGIN || "") : true,
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === "production" ? 200 : 10000, // Generous limit in development to prevent blocking
  standardHeaders: "draft-7",
  legacyHeaders: false
});
app.use(limiter);

const TASKS_FILE = path.join(process.cwd(), "tasks.json");

if (!fs.existsSync(TASKS_FILE)) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2), "utf8");
}

type TaskPriority = "Low" | "Medium" | "High";
type TaskStatus = "Pending" | "In Progress" | "Completed" | "Launched";

interface TaskComment {
  id: string;
  text: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  assigneeName: string;
  comments?: TaskComment[];
}

function readTasks(): Task[] {
  try {
    const data = fs.readFileSync(TASKS_FILE, "utf8");
    const parsed: any[] = JSON.parse(data);
    return parsed.map((t: any) => {
      const priority = (t.priority === "Low" || t.priority === "Medium" || t.priority === "High") ? t.priority : "Medium";
      const completed = typeof t.completed === "boolean" ? t.completed : false;

      let status = t.status;
      if (!status || !["Pending", "In Progress", "Completed", "Launched"].includes(status)) {
        status = completed ? "Completed" : "Pending";
      }

      const formattedDueDate = t.dueDate || new Date().toISOString().slice(0, 10);
      const assigneeName = t.assigneeName || "Alex Rivera";

      return {
        id: t.id,
        title: t.title || "Untitled Task",
        description: t.description || "",
        completed: status === "Completed" || status === "Launched",
        priority,
        status,
        dueDate: formattedDueDate,
        assigneeName,
        comments: Array.isArray(t.comments) ? t.comments : []
      };
    });
  } catch (err) {
    console.error("Error reading tasks file:", err);
    return [];
  }
}

function writeTasks(tasks: Task[]): void {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to tasks file:", err);
  }
}

const MEMBERS_FILE = path.join(process.cwd(), "members.json");
const DEFAULT_MEMBERS = [
  "Aarav Sharma",
  "Ananya Patel",
  "Chirag Mehta",
  "Harsha Reddy",
  "Manish Verma"
];

if (!fs.existsSync(MEMBERS_FILE)) {
  fs.writeFileSync(MEMBERS_FILE, JSON.stringify(DEFAULT_MEMBERS, null, 2), "utf8");
}

function readMembers(): string[] {
  try {
    const data = fs.readFileSync(MEMBERS_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading members file:", err);
    return DEFAULT_MEMBERS;
  }
}

function writeMembers(members: string[]): void {
  try {
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to members file:", err);
  }
}

const registerTaskRoutes = (routePrefix: string) => {

  app.get(`${routePrefix}`, (req, res) => {
    const tasks = readTasks();
    res.status(200).json(tasks);
  });

  app.get(`${routePrefix}/:id`, (req, res) => {
    const { id } = req.params;
    const tasks = readTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return res.status(404).json({ error: `Task with ID ${id} not found` });
    }
    res.status(200).json(task);
  });

  app.post(`${routePrefix}`, (req, res) => {
    const { title, description, priority, status, dueDate, assigneeName } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title is required and must be a string" });
    }

    if (title.length > 200) {
      return res.status(400).json({ error: "Title must be 200 characters or less" });
    }

    if (description && typeof description === "string" && description.length > 2000) {
      return res.status(400).json({ error: "Description must be 2000 characters or less" });
    }

    let taskPriority: TaskPriority = "Medium";
    if (priority === "Low" || priority === "Medium" || priority === "High") {
      taskPriority = priority;
    }

    let taskStatus: TaskStatus = "Pending";
    if (status === "Pending" || status === "In Progress" || status === "Completed" || status === "Launched") {
      taskStatus = status;
    }

    const defaultDueDate = dueDate || new Date().toISOString().slice(0, 10);
    const defaultAssignee = assigneeName || "Alex Rivera";

    const tasks = readTasks();
    const newTask: Task = {
      id: uuidv4(),
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      completed: taskStatus === "Completed" || taskStatus === "Launched",
      priority: taskPriority,
      status: taskStatus,
      dueDate: defaultDueDate,
      assigneeName: defaultAssignee,
    };

    tasks.push(newTask);
    writeTasks(tasks);

    res.status(201).json(newTask);
  });

  app.put(`${routePrefix}/:id`, (req, res) => {
    const { id } = req.params;
    const { title, description, completed, priority, status, dueDate, assigneeName } = req.body;

    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: `Task with ID ${id} not found` });
    }

    const updatedTask = { ...tasks[taskIndex] };

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Title must be a non-empty string" });
      }
      if (title.length > 200) {
        return res.status(400).json({ error: "Title must be 200 characters or less" });
      }
      updatedTask.title = title.trim();
    }

    if (description !== undefined) {
      if (description && typeof description === "string" && description.length > 2000) {
        return res.status(400).json({ error: "Description must be 2000 characters or less" });
      }
      updatedTask.description = typeof description === "string" ? description.trim() : "";
    }

    if (status !== undefined) {
      if (["Pending", "In Progress", "Completed", "Launched"].includes(status)) {
        updatedTask.status = status;
        updatedTask.completed = status === "Completed" || status === "Launched";
      } else {
        return res.status(400).json({ error: "Status must be 'Pending', 'In Progress', 'Completed', or 'Launched'" });
      }
    } else if (completed !== undefined) {
      updatedTask.completed = !!completed;
      if (updatedTask.completed) {
        if (updatedTask.status === "Pending" || updatedTask.status === "In Progress") {
          updatedTask.status = "Completed";
        }
      } else {
        if (updatedTask.status === "Completed" || updatedTask.status === "Launched") {
          updatedTask.status = "Pending";
        }
      }
    }

    if (priority !== undefined) {
      if (priority === "Low" || priority === "Medium" || priority === "High") {
        updatedTask.priority = priority;
      } else {
        return res.status(400).json({ error: "Priority must be 'Low', 'Medium', or 'High'" });
      }
    }

    if (dueDate !== undefined) {
      updatedTask.dueDate = String(dueDate);
    }

    if (assigneeName !== undefined) {
      updatedTask.assigneeName = String(assigneeName);
    }

    tasks[taskIndex] = updatedTask;
    writeTasks(tasks);

    res.status(200).json(updatedTask);
  });

  app.post(`${routePrefix}/:id/comments`, (req, res) => {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required and must be a string" });
    }

    if (text.length > 1000) {
      return res.status(400).json({ error: "Comment text must be 1000 characters or less" });
    }

    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: `Task with ID ${id} not found` });
    }

    const newComment: TaskComment = {
      id: uuidv4(),
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    if (!tasks[taskIndex].comments) {
      tasks[taskIndex].comments = [];
    }

    tasks[taskIndex].comments.push(newComment);
    writeTasks(tasks);

    res.status(201).json({ comment: newComment, task: tasks[taskIndex] });
  });

  app.delete(`${routePrefix}/:id/comments/:commentId`, (req, res) => {
    const { id, commentId } = req.params;

    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: `Task with ID ${id} not found` });
    }

    const task = tasks[taskIndex];
    if (task.comments) {
      const commentIndex = task.comments.findIndex((c) => c.id === commentId);
      if (commentIndex !== -1) {
        task.comments.splice(commentIndex, 1);
        writeTasks(tasks);
        return res.status(200).json({ success: true, task });
      }
    }

    res.status(404).json({ error: "Comment not found" });
  });

  app.delete(`${routePrefix}/:id`, (req, res) => {
    const { id } = req.params;

    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: `Task with ID ${id} not found` });
    }

    tasks.splice(taskIndex, 1);
    writeTasks(tasks);

    res.status(200).json({ success: true, message: "Task deleted successfully", id });
  });
};

const registerMemberRoutes = (routePrefix: string) => {
  app.get(`${routePrefix}`, (req, res) => {
    const members = readMembers();
    res.status(200).json(members);
  });

  app.post(`${routePrefix}`, (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Member name is required" });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: "Member name must be 100 characters or less" });
    }

    const trimmedName = name.trim();
    const members = readMembers();
    if (members.includes(trimmedName)) {
      return res.status(400).json({ error: "Member already exists" });
    }

    members.push(trimmedName);
    writeMembers(members);
    res.status(201).json(members);
  });

  app.delete(`${routePrefix}/:name`, (req, res) => {
    const { name } = req.params;
    const members = readMembers();
    const index = members.indexOf(name);
    if (index === -1) {
      return res.status(404).json({ error: "Member not found" });
    }

    members.splice(index, 1);
    writeMembers(members);
    res.status(200).json(members);
  });
};

// Healthcheck endpoint
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "Task Manager API Server" });
});

registerTaskRoutes("/api/tasks");
registerTaskRoutes("/tasks");

registerMemberRoutes("/api/members");
registerMemberRoutes("/members");

// Global error handler middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "An unexpected error occurred on the server" });
});

async function startServer() {
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
