import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Keeps track of which bell notifications this person has already seen
// (saved in this browser), and pops up a phone/desktop notification when a
// new one arrives while DormSphere is open or in the background.

const MAX_SEEN = 300;
const seenKey = (userId) => `dormsphere_notif_seen_${userId}`;

const supported = () => typeof window !== "undefined" && "Notification" in window;

function loadSeen(userId) {
  try {
    const raw = window.localStorage.getItem(seenKey(userId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(userId, set) {
  try {
    window.localStorage.setItem(seenKey(userId), JSON.stringify([...set].slice(-MAX_SEEN)));
  } catch {
    /* private mode etc. — the bell still works, it just forgets */
  }
}

// On an installed app (Android/iPhone) notifications must go through the
// service worker; a plain `new Notification` is the fallback on desktop.
async function showSystemNotification(item) {
  const options = {
    body: item.body,
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icon-192.png`,
    tag: item.id,
    data: { tab: item.tab },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(item.title, options);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(item.title, options);
  } catch {
    /* some mobile browsers only allow the service-worker route */
  }
}

export function useNotifications(userId, items, { ready = true } = {}) {
  const [seen, setSeen] = useState(() => (userId ? loadSeen(userId) : new Set()));
  const [permission, setPermission] = useState(() => (supported() ? Notification.permission : "unsupported"));
  // Ids already on screen at the last check. The first load only records
  // them, so opening the app doesn't fire a pile of old notifications.
  const known = useRef(null);

  useEffect(() => {
    if (userId) setSeen(loadSeen(userId));
    known.current = null;
  }, [userId]);

  useEffect(() => {
    if (!ready || !userId) return;
    const ids = items.map((i) => i.id);
    if (known.current === null) {
      known.current = new Set(ids);
      return;
    }
    const fresh = items.filter((i) => !known.current.has(i.id) && !seen.has(i.id));
    ids.forEach((id) => known.current.add(id));
    if (fresh.length && supported() && Notification.permission === "granted") {
      fresh.slice(0, 3).forEach(showSystemNotification);
    }
  }, [items, ready, userId, seen]);

  const unreadCount = useMemo(() => items.filter((i) => !seen.has(i.id)).length, [items, seen]);

  const markAllRead = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      saveSeen(userId, next);
      return next;
    });
  }, [items, userId]);

  const enablePhoneAlerts = useCallback(async () => {
    if (!supported()) return "unsupported";
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      showSystemNotification({
        id: "dormsphere-welcome",
        title: "Notifications are on 🔔",
        body: "You'll get an alert here when something new happens in DormSphere.",
        tab: "overview",
      });
    }
    return result;
  }, []);

  return { items, seen, unreadCount, markAllRead, permission, enablePhoneAlerts };
}
