import { CharacteristicValue, Service } from "homebridge";
import { VehicleData } from "../util/types";
import { wait } from "../util/wait";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class VehicleLockService extends TeslaPluginService {
  static serviceName = "Car Doors";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.LockMechanism(this.getFullName(), "carDoors");

    this.bind("LockCurrentState", {
      getter: this.getCurrentState,
    });

    this.bind("LockTargetState", {
      getter: this.getTargetState,
      setter: this.setTargetState,
    });
  }

  getCurrentState(data: VehicleData | null): CharacteristicValue {
    const { hap } = this.context;

    // Assume locked when not connected.
    const locked = data ? data.vehicle_state.locked : true;

    return locked
      ? hap.Characteristic.LockCurrentState.SECURED
      : hap.Characteristic.LockCurrentState.UNSECURED;
  }

  getTargetState(data: VehicleData | null): number {
    const { hap } = this.context;

    const currentState = this.getCurrentState(data);

    return currentState === hap.Characteristic.LockCurrentState.SECURED
      ? hap.Characteristic.LockTargetState.SECURED
      : hap.Characteristic.LockTargetState.UNSECURED;
  }

  async setTargetState(state: number) {
    const { service } = this;
    const { log, tesla, hap } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      const locked = state === hap.Characteristic.LockTargetState.SECURED;

      if (locked) {
        log("Locking vehicle.");
        await tesla.api("doorLock", options);
      } else {
        log("Unlocking vehicle.");
        await tesla.api("doorUnlock", options);
      }
    });

    // We need to update the current state "later" because Siri can't
    // handle receiving the change event inside the same "set target state"
    // response.
    await wait(1);

    if (state == hap.Characteristic.LockTargetState.SECURED) {
      service.setCharacteristic(
        hap.Characteristic.LockCurrentState,
        hap.Characteristic.LockCurrentState.SECURED,
      );
    } else {
      service.setCharacteristic(
        hap.Characteristic.LockCurrentState,
        hap.Characteristic.LockCurrentState.UNSECURED,
      );
    }
  }
}
