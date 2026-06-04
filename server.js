const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const TASKS_FILE = path.join(__dirname, 'tasks.json');

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(bodyParser.json());

// File-based task storage
const sampleTasks = [
  {
    id: 1,
    title: 'Complete project documentation',
    description: 'Write comprehensive documentation for the TaskFlow application including setup instructions and API endpoints.',
    completed: false,
    priority: 'high',
    createdAt: new Date('2024-01-15T10:00:00.000Z').toISOString()
  },
  {
    id: 2,
    title: 'Review pull requests',
    description: 'Review and approve pending pull requests from the development team.',
    completed: false,
    priority: 'medium',
    createdAt: new Date('2024-01-14T14:30:00.000Z').toISOString()
  },
  {
    id: 3,
    title: 'Update dependencies',
    description: 'Check for and update all npm packages to their latest stable versions.',
    completed: true,
    priority: 'low',
    createdAt: new Date('2024-01-13T09:15:00.000Z').toISOString()
  },
  {
    id: 4,
    title: 'Design system improvements',
    description: 'Enhance the Material UI theme with better color palette and typography.',
    completed: false,
    priority: 'medium',
    createdAt: new Date('2024-01-12T16:45:00.000Z').toISOString()
  },
  {
    id: 5,
    title: 'Deploy to production',
    description: 'Deploy the application to production environment and verify all functionality.',
    completed: false,
    priority: 'high',
    createdAt: new Date('2024-01-11T11:20:00.000Z').toISOString()
  }
];

// Read tasks from file
function readTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf8');
      return JSON.parse(data);
    } else {
      // Initialize with sample tasks if file doesn't exist
      fs.writeFileSync(TASKS_FILE, JSON.stringify(sampleTasks, null, 2));
      return sampleTasks;
    }
  } catch (error) {
    console.error('Error reading tasks file:', error);
    return sampleTasks;
  }
}

// Write tasks to file
function writeTasks(tasks) {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (error) {
    console.error('Error writing tasks file:', error);
  }
}

// Generate next sequential ID
function getNextId(tasks) {
  if (tasks.length === 0) return 1;
  const maxId = Math.max(...tasks.map(task => task.id));
  return maxId + 1;
}

// GET /tasks - Return all tasks
app.get('/tasks', (req, res) => {
  const tasks = readTasks();
  res.status(200).json(tasks);
});

// POST /tasks - Create a new task
app.post('/tasks', (req, res) => {
  const { title, description, priority } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  const tasks = readTasks();
  const newTask = {
    id: getNextId(tasks),
    title: title.trim(),
    description: description || '',
    completed: false,
    priority: priority || 'medium',
    createdAt: new Date().toISOString()
  };

  tasks.push(newTask);
  writeTasks(tasks);
  res.status(201).json(newTask);
});

// PUT /tasks/:id - Update a task
app.put('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const tasks = readTasks();
  const taskIndex = tasks.findIndex(task => task.id === parseInt(id));

  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const updatedTask = {
    ...tasks[taskIndex],
    ...updates,
    id: tasks[taskIndex].id, // Preserve original ID
    createdAt: tasks[taskIndex].createdAt // Preserve original createdAt
  };

  tasks[taskIndex] = updatedTask;
  writeTasks(tasks);
  res.status(200).json(updatedTask);
});

// DELETE /tasks/:id - Delete a task
app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;

  const tasks = readTasks();
  const taskIndex = tasks.findIndex(task => task.id === parseInt(id));

  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  tasks.splice(taskIndex, 1);
  writeTasks(tasks);
  res.status(200).json({ message: 'Task deleted successfully' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for ${FRONTEND_URL}`);
});
