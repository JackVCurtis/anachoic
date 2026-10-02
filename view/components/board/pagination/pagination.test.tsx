// Copied from anachoic inertia/components/completed/pagination/pagination.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { renderComponent } from '../../testing/render'
import { Pagination, type PaginationProps } from './pagination'

function renderPagination(props: Partial<PaginationProps> = {}) {
  const onPageChange = vi.fn()
  const element = (overrides: Partial<PaginationProps> = {}) => (
    <Pagination
      page={2}
      pageCount={3}
      busy={false}
      onPageChange={onPageChange}
      {...props}
      {...overrides}
    />
  )
  const rendered = renderComponent(element())
  return { ...rendered, onPageChange, element }
}

function previous(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Previous' })
}

function next(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Next' })
}

describe('Pagination', () => {
  test('"Next →" asks for the page after the one shown', async () => {
    const { user, onPageChange } = renderPagination({ page: 2 })

    await user.click(next())

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  test('"← Previous" asks for the page before the one shown', async () => {
    const { user, onPageChange } = renderPagination({ page: 2 })

    await user.click(previous())

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  test('the first page disables "← Previous"', async () => {
    const { user, onPageChange } = renderPagination({ page: 1 })

    expect(previous()).toBeDisabled()
    expect(next()).toBeEnabled()
    await user.click(next())
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  test('the last page disables "Next →"', async () => {
    const { user, onPageChange } = renderPagination({ page: 3 })

    expect(next()).toBeDisabled()
    expect(previous()).toBeEnabled()
    await user.click(previous())
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  test('while busy, the pressed button is busy and the other disabled', async () => {
    const { user, onPageChange, element, rerender } = renderPagination({ page: 2 })

    await user.click(next())
    rerender(element({ busy: true }))

    expect(next()).toHaveAttribute('aria-busy', 'true')
    expect(next()).toHaveFocus()
    expect(previous()).toBeDisabled()
    await user.click(next())
    expect(onPageChange).toHaveBeenCalledOnce()

    rerender(element({ page: 3, busy: false }))
    expect(next()).not.toHaveAttribute('aria-busy')
    expect(next()).toBeDisabled()
    expect(previous()).toBeEnabled()
  })

  test('busy with no button pressed here disables both', () => {
    renderPagination({ page: 2, busy: true })

    expect(previous()).toBeDisabled()
    expect(next()).toBeDisabled()
  })

  test('is a nav named "Pages" with the label in a status region', () => {
    renderPagination({ page: 2 })

    const nav = screen.getByRole('navigation', { name: 'Pages' })
    expect(nav).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Page 2 of 3')
    const arrows = [...nav.querySelectorAll('button [aria-hidden="true"]')]
    expect(arrows.map((arrow) => arrow.textContent)).toEqual(['←', '→'])
    expect(previous().firstElementChild).toBe(arrows[0])
    expect(next().lastElementChild).toBe(arrows[1])
  })

  test('is not drawn when there is one page', () => {
    const { container } = renderPagination({ page: 1, pageCount: 1 })

    expect(screen.queryByRole('navigation')).toBeNull()
    expect(container.querySelector('nav')).toBeNull()
  })
})
