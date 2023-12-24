import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class SteeringWheelHeaterService extends TeslaPluginService {
  static serviceName = "Steering Wheel Heater";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName(), "steeringWheelHeater");

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });
  }

  getOn(data: VehicleData | null) {
    // Assume off when not connected.
    return data ? !!data.climate_state.steering_wheel_heater : false;
  }

  async setOn(on: boolean) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      if (on) {
        // The wheel heater only turns on if the climate is on.
        log("Turning on climate control…");
        await tesla.api("climateStart", options);
      }

      log(`Turning steering wheel heater ${on ? "on" : "off"}.`);
      await tesla.api("steeringHeater", options, on);
    });
  }
}
