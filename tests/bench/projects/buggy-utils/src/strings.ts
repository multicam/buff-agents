/**
 * String Utilities
 * 
 * Note: This file contains intentional bugs for testing!
 */

/**
 * Capitalize the first letter of a string
 * BUG: Returns empty string for single character inputs
 */
export function capitalize(str: string): string {
    if (str.length <= 1) {
        return ''
    }
    return str[0].toUpperCase() + str.slice(1)
}

/**
 * Reverse a string
 * BUG: Doesn't handle empty strings properly
 */
export function reverse(str: string): string {
    return str.split('').reverse().join('')
}

/**
 * Check if a string is a palindrome
 * BUG: Case-sensitive comparison (should be case-insensitive)
 */
export function isPalindrome(str: string): boolean {
    const cleaned = str.replace(/[^a-zA-Z0-9]/g, '')
    return cleaned === cleaned.split('').reverse().join('')
}

/**
 * Truncate a string to a maximum length
 * BUG: Off-by-one error in length calculation
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length < maxLength) {
        return str
    }
    return str.slice(0, maxLength - 1) + '...'
}

/**
 * Count occurrences of a substring
 * BUG: Doesn't handle overlapping occurrences
 */
export function countOccurrences(str: string, substr: string): number {
    if (!substr) return 0
    return str.split(substr).length - 1
}
