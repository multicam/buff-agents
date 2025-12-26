/**
 * Todo App Types
 */

export interface Todo {
    id: string
    title: string
    completed: boolean
    createdAt: Date
    updatedAt: Date
    dueDate?: Date
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
}

export interface TodoList {
    id: string
    name: string
    todos: Todo[]
}

export type TodoFilter = 'all' | 'active' | 'completed'
