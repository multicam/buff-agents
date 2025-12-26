/**
 * Array Utilities
 * 
 * Note: This file contains intentional bugs for testing!
 */

/**
 * Find the maximum value in an array
 * BUG: Returns undefined for empty arrays instead of throwing
 */
export function max(arr: number[]): number {
    return Math.max(...arr)
}

/**
 * Find the minimum value in an array
 * BUG: Returns undefined for empty arrays instead of throwing
 */
export function min(arr: number[]): number {
    return Math.min(...arr)
}

/**
 * Calculate the sum of an array
 * BUG: Returns 0 for empty array, which might be incorrect
 */
export function sum(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0)
}

/**
 * Calculate the average of an array
 * BUG: Division by zero for empty arrays
 */
export function average(arr: number[]): number {
    return sum(arr) / arr.length
}

/**
 * Remove duplicates from an array
 * Works correctly!
 */
export function unique<T>(arr: T[]): T[] {
    return [...new Set(arr)]
}

/**
 * Flatten a nested array
 * BUG: Only flattens one level deep
 */
export function flatten<T>(arr: (T | T[])[]): T[] {
    return arr.flat() as T[]
}
