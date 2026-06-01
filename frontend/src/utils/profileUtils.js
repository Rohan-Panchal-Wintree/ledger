import { Laptop, Monitor, Smartphone } from "lucide-react";

export const profileSessionColumns = [
  { key: "browser", label: "Browser" },
  { key: "device", label: "Device" },
  { key: "type", label: "Type" },
  { key: "network", label: "IP / Network" },
  { key: "started", label: "Started" },
  { key: "action", label: "Action", align: "right" },
];

export function getSessionIcon(deviceType) {
  if (deviceType === "mobile") return Smartphone;
  if (deviceType === "tablet") return Smartphone;
  if (deviceType === "desktop") return Laptop;

  return Monitor;
}

export function formatProfileDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} : ${hours}:${minutes}`;
}

export function formatNetwork(ipAddress) {
  if (
    !ipAddress ||
    ipAddress === "::1" ||
    ipAddress === "127.0.0.1" ||
    ipAddress === "::ffff:127.0.0.1"
  ) {
    return "Local device";
  }

  return ipAddress;
}
