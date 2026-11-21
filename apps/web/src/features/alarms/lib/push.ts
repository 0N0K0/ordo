import { sendPushRemoval, sendPushSubscription, type PushDevice } from '../api';
import { loadRings, openRingTarget, ringPushed } from './ringing';

/**
 * Push notifications of this device (Web Push): the service worker of the app (`public/push-sw.js`,
 * imported by the generated one) shows the rings the server pushes while the app is closed; this module subscribes or
 * unsubscribes this device and hears what the service worker tells the open app (a ring pushed while a tab is visible,
 * a ring stopped or snoozed from a notification, a notification opened).
 */

/** What the service worker tells the open tabs. */
type PushMessage = { type: 'ordo.push.ring'; key: string } | { type: 'ordo.push.changed' } | { type: 'ordo.push.open'; path: string; workspaceId: string | null };

/**
 * Whether this browser can receive push notifications (service worker, Push API, notifications).
 * @returns {boolean} Supported.
 */
export function pushSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
}

/**
 * Registration of the service worker of the app, if it runs one (none in development).
 * @returns {Promise<ServiceWorkerRegistration | undefined>} Registration.
 */
async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return pushSupported() ? navigator.serviceWorker.getRegistration() : undefined;
}

/**
 * Push subscription of this device, if any.
 * @returns {Promise<PushSubscription | null>} Subscription.
 */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  return (await registration())?.pushManager.getSubscription() ?? null;
}

/** Browsers, as their user agents tell them (the first that matches: Edge and Opera say « Chrome » too). */
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

/** Systems, as the user agents tell them. */
const SYSTEMS: [RegExp, string][] = [
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
];

/**
 * Device as the user reads it in the list (« Chrome · Android »), from the user agent.
 * @param {string} [userAgent] User agent. Optional. Default = this browser's.
 * @returns {string} Label.
 */
export function deviceLabel(userAgent: string = navigator.userAgent): string {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? 'Navigateur';
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return [browser, system].filter(Boolean).join(' · ');
}

/**
 * Key of the server as the Push API takes it (base64url to bytes).
 * @param {string} key Public VAPID key (base64url).
 * @returns {Uint8Array<ArrayBuffer>} Bytes.
 */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = `${key}${'='.repeat((4 - (key.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/**
 * Subscribes this device to the push notifications: the permission asked, the service worker subscribed with the key
 * of the server, the subscription given to the API.
 * @param {string} publicKey Public VAPID key of the server.
 * @returns {Promise<void>} Done.
 * @throws {Error} Unsupported, no service worker (development), permission refused: the message tells what to do.
 */
export async function subscribeThisDevice(publicKey: string): Promise<void> {
  if (!pushSupported()) throw new Error('Ce navigateur ne reçoit pas de notifications push.');
  const worker = await registration();
  if (!worker) throw new Error('Les notifications push demandent le service worker de l’app (l’app installée ou servie en production).');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Les notifications sont refusées pour Ordo : autorisez-les dans les réglages du site de ce navigateur.');
  const subscription = (await worker.pushManager.getSubscription()) ?? (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Le navigateur n’a pas donné d’abonnement push.');
  await sendPushSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth, label: deviceLabel() });
}

/**
 * Unsubscribes this device: its browser subscription ended and its device removed from the API.
 * @param {readonly PushDevice[]} devices Devices of the user (this one found by its endpoint).
 * @returns {Promise<void>} Done.
 */
export async function unsubscribeThisDevice(devices: readonly PushDevice[]): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const device = devices.find((item) => item.endpoint === subscription.endpoint);
  await subscription.unsubscribe();
  if (device) await sendPushRemoval(device.id);
}

/**
 * Hears the service worker while the app is open: a ring pushed while a tab is visible sounds here (no notification
 * then), a ring stopped or snoozed from a notification is followed, a notification opened opens its page in its
 * workspace.
 * @returns {() => void} Stops hearing.
 */
export function listenToPushes(): () => void {
  if (!pushSupported()) return () => undefined;
  /**
   * Handles a message of the service worker.
   * @param {MessageEvent<PushMessage>} event Message.
   * @returns {void}
   */
  const onMessage = (event: MessageEvent<PushMessage>) => {
    const message = event.data;
    if (message?.type === 'ordo.push.ring') void ringPushed(message.key);
    else if (message?.type === 'ordo.push.changed') void loadRings();
    else if (message?.type === 'ordo.push.open') openRingTarget({ path: message.path, workspaceId: message.workspaceId });
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
