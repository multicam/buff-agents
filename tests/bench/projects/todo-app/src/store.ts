/**
 * Todo Store
 * 
 * In-memory store for todos.
 */

import type { Todo, TodoList, TodoFilter } from './types'

export class TodoStore {
    private lists: Map<string, TodoList> = new Map()

    createList(name: string): TodoList {
        const list: TodoList = {
            id: crypto.randomUUID(),
            name,
            todos: [],
        }
        this.lists.set(list.id, list)
        return list
    }

    getList(id: string): TodoList | undefined {
        return this.lists.get(id)
    }

    getAllLists(): TodoList[] {
        return Array.from(this.lists.values())
    }

    addTodo(listId: string, title: string): Todo | undefined {
        const list = this.lists.get(listId)
        if (!list) return undefined

        const todo: Todo = {
            id: crypto.randomUUID(),
            title,
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        list.todos.push(todo)
        return todo
    }

    toggleTodo(listId: string, todoId: string): boolean {
        const list = this.lists.get(listId)
        if (!list) return false

        const todo = list.todos.find(t => t.id === todoId)
        if (!todo) return false

        todo.completed = !todo.completed
        todo.updatedAt = new Date()
        return true
    }

    deleteTodo(listId: string, todoId: string): boolean {
        const list = this.lists.get(listId)
        if (!list) return false

        const index = list.todos.findIndex(t => t.id === todoId)
        if (index === -1) return false

        list.todos.splice(index, 1)
        return true
    }

    filterTodos(listId: string, filter: TodoFilter): Todo[] {
        const list = this.lists.get(listId)
        if (!list) return []

        switch (filter) {
            case 'active':
                return list.todos.filter(t => !t.completed)
            case 'completed':
                return list.todos.filter(t => t.completed)
            default:
                return list.todos
        }
    }
}
