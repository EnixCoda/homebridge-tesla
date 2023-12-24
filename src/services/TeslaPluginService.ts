import {
  CharacteristicGetCallback,
  CharacteristicValue,
  HAP,
  HAPStatus,
  Logging,
  Nullable,
  Service,
} from "homebridge";
import { TeslaApi } from "../util/api";
import { TeslaPluginConfig, VehicleData } from "../util/types";

export type TeslaPluginServiceContext = {
  log: Logging;
  hap: HAP;
  config: TeslaPluginConfig;
  tesla: TeslaApi;
};

export abstract class TeslaPluginService {
  public abstract readonly service: Service;
  static readonly serviceName: string = "TeslaPluginService";

  constructor(protected readonly context: TeslaPluginServiceContext) {}

  bind = <T extends CharacteristicValue>(
    characteristicKey: keyof HAP["Characteristic"],
    {
      getter,
      setter,
    }: {
      getter?: Getter<T>;
      setter?: Setter<T>;
    },
  ) => {
    const characteristic = this.service.getCharacteristic(
      this.context.hap.Characteristic[characteristicKey as string],
    );
    if (getter) {
      characteristic.on("get", this.createGetter(getter));
      this.context.tesla.on("vehicleDataUpdated", async (data) =>
        characteristic.updateValue(await getter(data)),
      );
    }
    if (setter) characteristic.on("set", this.createSetter(setter));
  };

  getFullName(): string {
    // Optional prefix to prepend to all accessory names.
    const prefix = (this.context.config.prefix ?? "").trim();
    const serviceName =
      (this.constructor as typeof TeslaPluginService).serviceName ||
      this.constructor.prototype.serviceName;
    return prefix.length > 0 ? `${prefix} ${serviceName}` : serviceName;
  }

  //
  // Type-safe callbackify.
  //

  protected createGetter<T extends CharacteristicValue>(getter: Getter<T>): GetterCallback {
    return (callback) => {
      this.context.tesla
        .getVehicleData()
        .then((data) => getter.call(this, data))
        .then((value) => callback(null, value))
        .catch((error: Error) => callback(error));
    };
  }

  protected createSetter<T extends CharacteristicValue>(setter: Setter<T>): SetterCallback {
    return (value, callback) => {
      setter
        .call(this, value as T)
        .then((writeResponse) => callback(null, writeResponse ?? undefined))
        .catch((error: Error) => callback(error));
    };
  }
}

type Getter<T extends CharacteristicValue> = (
  this: any,
  data: VehicleData | null,
) => Promise<T> | T;

type GetterCallback = (callback: CharacteristicGetCallback) => void;

type Setter<T extends CharacteristicValue> = (this: any, value: T) => Promise<Nullable<T> | void>;

type SetterCallback = (
  value: CharacteristicValue,
  callback: (
    error?: HAPStatus | Error | null,
    writeResponse?: Nullable<CharacteristicValue>,
  ) => void,
) => void;
