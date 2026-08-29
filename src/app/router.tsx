import { type AnchorHTMLAttributes, type MouseEvent, useSyncExternalStore } from 'react'
import { parseCalendarRoute } from './routes'

const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

const getPathname = () => window.location.pathname

export function usePathname() {
  return useSyncExternalStore(subscribe, getPathname)
}

export function useCalendarRoute() {
  return parseCalendarRoute(usePathname())
}

export function Link({ href = '', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    window.history.pushState(null, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return <a href={href} onClick={navigate} {...props} />
}
