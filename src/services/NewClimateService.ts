import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class NewClimateService extends TeslaPluginService {
  static serviceName = "Climate";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.HeaterCooler(this.getFullName(), "");

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });
  }

  getOn = (data: VehicleData | null) => {
    // Assume off when not connected.
    return data ? data.climate_state.is_climate_on : false;
  };

  async setOn(on: boolean) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      if (on) {
        log("Turning on climate.");
        await tesla.api("startCharge", options);
      } else {
        log("Turning off climate.");
        await tesla.api("stopCharge", options);
      }
    });
  }
}
