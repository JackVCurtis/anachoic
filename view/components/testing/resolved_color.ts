// Copied from anachoic inertia/components/testing/resolved_color.ts at fd99e0d
/**
 * The computed color a token resolves to at the given element, found by
 * painting a probe with it. Compare it with a computed style, which is
 * written in the same form.
 */
export function resolvedColor(token: string, within: Element = document.body): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${token})`
  within.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}
