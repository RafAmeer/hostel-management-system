import { ScanIcon, MapPinIcon } from "./icons";
import { isPhoneDevice } from "../../lib/device";
import { assetUrl } from "../../lib/assetUrl";

// "Scan Curfew" entry point shared by Home and the Curfew tab. Scanning
// needs the phone's camera and GPS, so on a desktop browser this shows a
// note instead of a button.
function CurfewScanCard({ compact = false }) {
  const onPhone = isPhoneDevice();

  if (!onPhone) {
    return (
      <section className="glass-panel scan-card scan-card--disabled">
        <span className="scan-card__icon" aria-hidden="true">
          <ScanIcon />
        </span>
        <div className="scan-card__text">
          <h3 className="scan-card__title">Scan Curfew</h3>
          <p className="scan-card__sub">
            Curfew scanning is only available on your phone. Open DormSphere on your phone at the
            hostel entrance.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel scan-card">
      <span className="scan-card__icon" aria-hidden="true">
        <ScanIcon />
      </span>
      <div className="scan-card__text">
        <h3 className="scan-card__title">Scan Curfew</h3>
        <p className="scan-card__sub">
          {compact
            ? "Check in or out at the entrance."
            : "Scan the QR poster at the hostel entrance to check in or out. Your location is checked when you scan."}
        </p>
      </div>
      <a className="primary-btn scan-card__btn" href={assetUrl("curfew")}>
        <MapPinIcon aria-hidden="true" /> Scan now
      </a>
    </section>
  );
}

export default CurfewScanCard;
