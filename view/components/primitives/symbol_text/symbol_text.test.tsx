import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { SymbolText } from './symbol_text'

function render(text: string) {
  const { container } = renderComponent(
    <p>
      <SymbolText>{text}</SymbolText>
    </p>
  )
  return container.querySelector('p')!
}

describe('SymbolText', () => {
  test('draws the text as it is', () => {
    expect(render('Step 2 · Draft the adapter').textContent).toBe('Step 2 · Draft the adapter')
  })

  test.each(['·', '↗', '→', '←', '×', '⇧'])('hides %s and keeps the spaces around it', (symbol) => {
    const line = render(`Before ${symbol} after`)
    const hidden = line.querySelectorAll('[aria-hidden="true"]')

    expect(hidden).toHaveLength(1)
    expect(hidden[0].textContent).toBe(symbol)
    hidden[0].remove()
    expect(line.textContent).toBe('Before  after')
  })

  test('hides every symbol in a line and nothing else', () => {
    const line = render('Pull request · step 1 ↗')
    const hidden = [...line.querySelectorAll('[aria-hidden="true"]')].map(
      (span) => span.textContent
    )

    expect(hidden).toEqual(['·', '↗'])
  })

  test('reads the dash of an empty value as none', () => {
    const line = render('agent —')

    expect(line.querySelector('[aria-hidden="true"]')?.textContent).toBe('—')
    line.querySelector('[aria-hidden="true"]')!.remove()
    expect(line.textContent).toBe('agent none')
  })

  test('draws text without symbols with no span', () => {
    expect(render('Waiting on user').querySelector('span')).toBeNull()
  })
})
