import { CheckIcon, AlertIcon, InfoIcon } from "./dashboard/icons";

const ICONS = { success: CheckIcon, error: AlertIcon, info: InfoIcon };

// Floating notification pill. Sits above everything (login, dashboards,
// scan page) so the same component confirms sign-in, sign-up, booking
// updates and so on.
function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const Icon = ICONS[toast.type] ?? InfoIcon;
  return (
    <div
      key={toast.id}
      className={"app-toast app-toast--" + toast.type}
      role={toast.type === "error" ? "alert" : "status"}
      onClick={onDismiss}
    >
      <span className="app-toast__icon" aria-hidden="true">
        <Icon />
      </span>
      <span>{toast.message}</span>
    </div>
  );
}

export default Toast;
