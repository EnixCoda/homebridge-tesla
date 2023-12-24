import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class ChargerService extends TeslaPluginService {
  static serviceName = "Charger";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName(), "charger");

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });
  }

  getOn = (data: VehicleData | null) => {
    // Assume off when not connected.
    return data ? data.charge_state.charging_state === "Charging" : false;
  };

  async setOn(on: boolean) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      if (on) {
        log("Beginning charging.");
        await tesla.api("startCharge", options);
      } else {
        log("Stopping charging.");
        await tesla.api("stopCharge", options);
      }
    });
  }
}
