import { CharacteristicValue, Service } from "homebridge";
import { VehicleData } from "../util/types";
import { wait } from "../util/wait";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class HomeLinkService extends TeslaPluginService {
  static serviceName = "HomeLink";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.GarageDoorOpener(this.getFullName(), "homeLink");

    this.bind("CurrentDoorState", {
      getter: this.getCurrentState,
    });

    this.bind("TargetDoorState", {
      getter: this.getTargetState,
      setter: this.setTargetState,
    });
  }

  getCurrentState(data: VehicleData | null): CharacteristicValue {
    const { hap } = this.context;
    return hap.Characteristic.CurrentDoorState.CLOSED;
  }

  getTargetState(data: VehicleData | null): number {
    const { hap } = this.context;
    return hap.Characteristic.TargetDoorState.CLOSED;
  }

  async setTargetState(state: number) {
    const { service } = this;
    const { log, tesla, hap } = this.context;
    const { latitude, longitude } = this.context.config;

    await tesla.wakeAndCommand(async (options) => {
      const data = await tesla.getVehicleData();

      if (!data) {
        log("Cannot trigger HomeLink without current vehicle state.");
        return;
      }

      // This will only succeed if the car is already online and within proximity to the
      // latitude and longitude settings.
      if (data.vehicle_state.homelink_nearby) {
        const results = await tesla.api("homelink", options, latitude, longitude);
        log("HomeLink activated: ", results.result);
      } else {
        log("HomeLink not available; vehicle reports not nearby.");
      }
    });

    // We need to update the current state "later" because Siri can't
    // handle receiving the change event inside the same "set target state"
    // response.
    await wait(1);

    if (state == hap.Characteristic.TargetDoorState.CLOSED) {
      service.setCharacteristic(
        hap.Characteristic.CurrentDoorState,
        hap.Characteristic.CurrentDoorState.CLOSED,
      );
    } else {
      service.setCharacteristic(
        hap.Characteristic.CurrentDoorState,
        hap.Characteristic.CurrentDoorState.OPEN,
      );
    }
  }
}
