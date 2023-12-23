import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class SentryModeService extends TeslaPluginService {
  name = "Sentry Mode";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName(), "sentryMode");

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });
  }

  getOn(data: VehicleData | null) {
    // Assume off when not connected.
    return data ? data.vehicle_state.sentry_mode : false;
  }

  async setOn(on: boolean) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      if (on) {
        log("Enabling Sentry Mode.");
        await tesla.api("setSentryMode", options, true);
      } else {
        log("Disabling Sentry Mode.");
        await tesla.api("setSentryMode", options, false);
      }
    });
  }
}
