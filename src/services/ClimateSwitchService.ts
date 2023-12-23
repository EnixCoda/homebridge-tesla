import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class ClimateSwitchService extends TeslaPluginService {
  name = "Climate";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName(), "climate");

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });
  }

  getOn(data: VehicleData | null) {
    // Assume off when not connected.
    return data?.climate_state?.is_climate_on ?? false;
  }

  async setOn(on: boolean) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      if (on) {
        log("Turning on climate control…");
        await tesla.api("climateStart", options);
      } else {
        log("Turning off climate control…");
        await tesla.api("climateStop", options);
      }
    });
  }
}
