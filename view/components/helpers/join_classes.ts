// Copied from anachoic inertia/components/helpers/join_classes.ts at fd99e0d
/**
 * Joins class names with a space, in the order given. Falsy entries are
 * dropped, so a class can be added on a condition:
 * `joinClasses(styles.card, selected && styles.selected)`.
 */
export function joinClasses(...classes: Array<string | false | null | undefined | 0>): string {
  return classes.filter(Boolean).join(' ')
}
