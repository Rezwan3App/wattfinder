import assert from "node:assert";
import {
  connectorLabel,
  currentLabel,
  inferConnectorFromStationName,
} from "./connectors";

assert.equal(connectorLabel(1), "Type1");
assert.equal(connectorLabel(32), "CCS");
assert.equal(connectorLabel(27), "Tesla");
assert.equal(connectorLabel(30), "Tesla");
assert.equal(connectorLabel(1040), "NACS");
assert.equal(connectorLabel(28), "Type2");
assert.equal(connectorLabel(14), "NEMA1450");
assert.equal(connectorLabel(null), "Unknown");
assert.equal(connectorLabel(9999), "Unknown (9999)");

assert.equal(currentLabel(30), "DC");
assert.equal(currentLabel(10), "AC (1-phase)");
assert.equal(currentLabel(null), null);

assert.equal(
  inferConnectorFromStationName("Unknown", "Forest Ave - Tesla Destination"),
  "Tesla",
);
assert.equal(inferConnectorFromStationName("Unknown", "Bruno's Bakery"), "Unknown");
assert.equal(inferConnectorFromStationName("CCS", "Tesla Supercharger"), "CCS");

console.log("ok  connector map + Tesla name inference");
console.log("\nAll connector checks passed.");
