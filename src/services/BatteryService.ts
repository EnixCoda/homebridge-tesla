import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class BatteryService extends TeslaPluginService {
  service: Service;
  name = "Battery";

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Battery(this.getFullName(), "battery");

    this.bind("BatteryLevel", { getter: this.getLevel });
    this.bind("ChargingState", { getter: this.getChargingState });
    this.bind("StatusLowBattery", { getter: this.getLowBattery });
  }

  getLevel(data: VehicleData | null): number {
    // Assume 50% when not connected and no last-known state.
    return data ? data.charge_state.battery_level : 50;
  }

  getChargingState(data: VehicleData | null): number {
    const { hap } = this.context;

    if (data) {
      return data.charge_state.charging_state === "Charging"
        ? hap.Characteristic.ChargingState.CHARGING
        : hap.Characteristic.ChargingState.NOT_CHARGING;
    } else {
      // Assume not charging when not connected and no last-known state.
      return hap.Characteristic.ChargingState.NOT_CHARGING;
    }
  }

  getLowBattery(data: VehicleData | null): boolean {
    // Assume normal battery when not connected and no last-known state.
    return data ? data.charge_state.battery_level <= 20 : false;
  }
}
