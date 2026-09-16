/**
 * Browser notification wrapper.
 *
 * Notifications are strictly opt-in (the setting ships as `false`) and every
 * call degrades silently: unsupported browsers, denied permissions and the
 * occasional `TypeError` thrown by strict iframe sandboxes are all treated as
 * "no notification", never as an error the user has to see.
 */
import { assetUrl } from './assets'

export type NotificationState = 'unsupported' | 'default' | 'granted' | 'denied'

export function getNotificationState(): NotificationState {
  if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
    return 'unsupported'
  }
  return Notification.permission as NotificationState
}

export async function requestNotificationPermission(): Promise<NotificationState> {
  if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
    return 'unsupported'
  }
  if (Notification.permission !== 'default') {
    return Notification.permission as NotificationState
  }
  try {
    const result = await Notification.requestPermission()
    return (result ?? Notification.permission) as NotificationState
  } catch {
    return getNotificationState()
  }
}

export interface NotificationPayload {
  title: string
  body?: string
  tag?: string
}

export function showNotification({ title, body, tag }: NotificationPayload): boolean {
  if (getNotificationState() !== 'granted') {
    return false
  }
  try {
    const notification = new Notification(title, {
      body,
      tag: tag ?? 'school-survival-clock',
      icon: assetUrl('icon-192.png'),
      badge: assetUrl('icon-192.png'),
      lang: 'ko-KR',
      silent: false,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return true
  } catch {
    return false
  }
}
