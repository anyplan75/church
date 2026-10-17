"use strict";

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);

function cleanHost(value) {
  const text = String(value ?? "").trim();
  return IPV4.test(text) ? text : "";
}

function isPrivateIpv4(value) {
  const host = cleanHost(value);
  if (!host) return false;
  const [a, b] = host.split(".").map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return a === 192 && b === 168;
}

module.exports = { cleanHost, isPrivateIpv4 };
