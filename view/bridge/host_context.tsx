import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { TimeZoneProvider } from '../components/hooks/use_now/use_now'
import type { HostContextStore, ViewHostContext } from './connect'

const EMPTY: ViewHostContext = {
  displayMode: undefined,
  availableDisplayModes: undefined,
  safeAreaInsets: undefined,
  locale: undefined,
  timeZone: undefined,
}

const HostContextContext = createContext<ViewHostContext>(EMPTY)

/**
 * Hands the views the parts of the host context they use, and shows times in
 * the host's time zone. It re-renders only when one of those parts changes.
 */
export function HostContextProvider({
  store,
  children,
}: {
  store: HostContextStore
  children: ReactNode
}) {
  const context = useSyncExternalStore(store.subscribe, store.getViewSnapshot)
  return (
    <HostContextContext.Provider value={context}>
      <TimeZoneProvider timeZone={context.timeZone}>{children}</TimeZoneProvider>
    </HostContextContext.Provider>
  )
}

export function useHostContext(): ViewHostContext {
  return useContext(HostContextContext)
}
