import { ArrowRightLeft, Banknote, CarFront, CreditCard, QrCode, Truck } from "lucide-react";
import { paymentLabels } from "./format.js";

const vehicleLabels = {
  AUTO: "Auto",
  MOTO: "Moto",
  CAMIONETA: "Camioneta",
};

export function VehicleIcon({ category, size = 20 }) {
  if (category === "MOTO") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="5" cy="17" r="3" />
        <circle cx="19" cy="17" r="3" />
        <path d="M13 4h3l3 13M3 10h5l-3 7h8l-3-5H5m5 0h7M10 8h3l3 4" />
      </svg>
    );
  }
  const Icon = { AUTO: CarFront, CAMIONETA: Truck }[category];
  return Icon ? <Icon size={size} aria-hidden="true" focusable="false" /> : null;
}

export function PaymentIcon({ method, size = 18 }) {
  const Icon = {
    EFECTIVO: Banknote,
    DEBITO: CreditCard,
    CREDITO: CreditCard,
    QR: QrCode,
    TRANSFERENCIA: ArrowRightLeft,
  }[method];
  return Icon ? <Icon size={size} aria-hidden="true" focusable="false" /> : null;
}

export function VehicleLabel({ category, size = 18 }) {
  return (
    <span className="sf-icon-label">
      <VehicleIcon category={category} size={size} />
      {vehicleLabels[category] || category}
    </span>
  );
}

export function PaymentLabel({ method, size = 18 }) {
  return (
    <span className="sf-icon-label">
      <PaymentIcon method={method} size={size} />
      {paymentLabels[method] || method || "—"}
    </span>
  );
}
