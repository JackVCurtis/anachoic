// Copied from anachoic inertia/components/hooks/use_escape_layer/use_escape_layer.tsx at fd99e0d
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from 'react'

/**
 * The things open inside a container that Escape closes before the container
 * itself: a confirmation, a deny form. The one opened last is the innermost.
 */
export class EscapeLayers {
  #closers: Array<() => void> = []

  /**
   * Adds a layer. Returns the function that removes it again.
   */
  add(close: () => void): () => void {
    const entry = () => close()
    this.#closers.push(entry)
    return () => {
      this.#closers = this.#closers.filter((closer) => closer !== entry)
    }
  }

  /**
   * Closes the innermost layer. False when none is open.
   */
  closeInnermost(): boolean {
    const close = this.#closers.at(-1)
    if (!close) {
      return false
    }
    close()
    return true
  }
}

const EscapeLayersContext = createContext<EscapeLayers | null>(null)

/**
 * Makes the layers of a container, such as the task drawer, known to what
 * opens inside it.
 */
export function EscapeLayersProvider({
  layers,
  children,
}: {
  layers: EscapeLayers
  children: ReactNode
}) {
  return <EscapeLayersContext.Provider value={layers}>{children}</EscapeLayersContext.Provider>
}

/**
 * The layers of a container, kept for the life of the component.
 */
export function useEscapeLayers(): EscapeLayers {
  const [layers] = useState(() => new EscapeLayers())
  return layers
}

/**
 * Registers something that is open, for as long as the calling component is
 * mounted, so that the surrounding container's Escape closes it first.
 * Outside a container it does nothing.
 */
export function useEscapeLayer(close: () => void): void {
  const layers = useContext(EscapeLayersContext)
  const closeLatest = useEffectEvent(close)

  useEffect(() => {
    if (!layers) {
      return
    }
    return layers.add(() => closeLatest())
  }, [layers])
}
