/**
 * API Client Base
 * 
 * A simple HTTP client wrapper.
 */

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    headers?: Record<string, string>
    body?: unknown
    timeout?: number
}

export interface ApiResponse<T> {
    data: T
    status: number
    headers: Headers
}

export class ApiClient {
    private baseUrl: string
    private defaultHeaders: Record<string, string>

    constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, '')
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            ...defaultHeaders,
        }
    }

    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        const url = `${this.baseUrl}${endpoint}`
        const { method = 'GET', headers = {}, body, timeout = 30000 } = options

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
            const response = await fetch(url, {
                method,
                headers: { ...this.defaultHeaders, ...headers },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            })

            const data = await response.json() as T

            return {
                data,
                status: response.status,
                headers: response.headers,
            }
        } finally {
            clearTimeout(timeoutId)
        }
    }

    async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'GET' })
    }

    async post<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'POST', body })
    }

    async put<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'PUT', body })
    }

    async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' })
    }
}
