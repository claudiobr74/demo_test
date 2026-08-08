import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Task = {
  id: string
  title: string
  done: boolean
  createdAt: number
}

type Filter = 'all' | 'active' | 'done'

const STORAGE_KEY = 'task-board.tasks.v1'

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Task[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const remaining = useMemo(() => tasks.filter((t) => !t.done).length, [tasks])

  const visibleTasks = useMemo(() => {
    switch (filter) {
      case 'active':
        return tasks.filter((t) => !t.done)
      case 'done':
        return tasks.filter((t) => t.done)
      default:
        return tasks
    }
  }, [tasks, filter])

  function addTask() {
    const trimmed = title.trim()
    if (!trimmed) return
    const task: Task = {
      id: crypto.randomUUID(),
      title: trimmed,
      done: false,
      createdAt: Date.now(),
    }
    setTasks((prev) => [task, ...prev])
    setTitle('')
  }

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    )
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  function clearCompleted() {
    setTasks((prev) => prev.filter((t) => !t.done))
  }

  return (
    <div className="app">
      <div className="card">
        <header className="header">
          <h1 className="title">Task Board</h1>
          <p className="subtitle">
            {remaining} {remaining === 1 ? 'task' : 'tasks'} remaining
          </p>
        </header>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            addTask()
          }}
        >
          <input
            className="composer-input"
            type="text"
            value={title}
            placeholder="What needs to be done?"
            aria-label="New task title"
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!title.trim()}>
            Add
          </button>
        </form>

        <div className="filters" role="tablist" aria-label="Filter tasks">
          {(['all', 'active', 'done'] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`chip ${filter === f ? 'chip-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <ul className="list">
          {visibleTasks.length === 0 && (
            <li className="empty">Nothing here yet — add your first task above.</li>
          )}
          {visibleTasks.map((task) => (
            <li key={task.id} className={`item ${task.done ? 'item-done' : ''}`}>
              <label className="item-main">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTask(task.id)}
                  aria-label={`Mark "${task.title}" as ${task.done ? 'active' : 'done'}`}
                />
                <span className="item-title">{task.title}</span>
              </label>
              <button
                className="btn btn-ghost"
                onClick={() => removeTask(task.id)}
                aria-label={`Delete "${task.title}"`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        <footer className="footer">
          <span className="count">{tasks.length} total</span>
          <button
            className="btn btn-ghost"
            onClick={clearCompleted}
            disabled={!tasks.some((t) => t.done)}
          >
            Clear completed
          </button>
        </footer>
      </div>
    </div>
  )
}

export default App
