import { AlertIcon, InfoIcon } from "./icons";

// Shown to a student whose account Finance hasn't verified yet (Home and
// Rooms). Verified students never see it.
function FinanceNotice({ status = "pending", note }) {
  if (status === "verified") return null;
  const rejected = status === "rejected";
  const Icon = rejected ? AlertIcon : InfoIcon;
  return (
    <div className={"finance-notice" + (rejected ? " finance-notice--rejected" : "")} role="status">
      <Icon aria-hidden="true" width={22} height={22} />
      <div>
        <p className="finance-notice__title">
          {rejected ? "Finance couldn't verify your account" : "Waiting for Finance verification"}
        </p>
        <p className="finance-notice__text">
          {rejected
            ? note
              ? `Reason: ${note}. Please visit the Finance office to sort it out.`
              : "Please visit the Finance office to sort it out."
            : "Finance checks every new account before room booking opens. You can look around in the meantime — we'll let you know when you're verified."}
        </p>
      </div>
    </div>
  );
}

export default FinanceNotice;
