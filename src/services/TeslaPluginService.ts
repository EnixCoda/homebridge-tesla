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

  bind<T extends CharacteristicValue>(
    characteristicKey: keyof HAP["Characteristic"],
    {
      getter,
      setter,
      fallbackValue,
    }: {
      getter?: Getter<T>;
      setter?: Setter<T>;
      fallbackValue: T;
    },
  ) {
    const characteristic = this.service.getCharacteristic(
      this.context.hap.Characteristic[characteristicKey as string],
    );
    const serviceName = this.getServiceName();
    if (getter) {
      const boundGetter = getter.bind(this);
      const createdGetter = this.createGetter(boundGetter, fallbackValue);
      characteristic.on("get", (callback) => {
        this.context.log("[bind]", serviceName, "get", characteristicKey);
        return createdGetter(callback);
      });
      this.context.tesla.on("vehicleDataUpdated", async (data) => {
        this.context.log("[bind]", serviceName, "vehicleDataUpdated", characteristicKey);
        characteristic.updateValue(await boundGetter(data));
      });
    }
    if (setter) {
      const boundSetter = setter.bind(this);
      const createdSetter = this.createSetter(boundSetter, fallbackValue);
      characteristic.on("set", (value, callback) => {
        this.context.log("[bind]", serviceName, "set", characteristicKey, value);
        return createdSetter(value, callback);
      });
    }
  }

  private getServiceName() {
    return (this.constructor as typeof TeslaPluginService).serviceName;
  }

  getFullName(): string {
    // Optional prefix to prepend to all accessory names.
    const prefix = (this.context.config.prefix ?? "").trim();
    const serviceName = this.getServiceName();
    this.context.log.info(`getFullName: ${prefix} ${serviceName}`);
    return prefix.length > 0 ? `${prefix} ${serviceName}` : serviceName;
  }

  //
  // Type-safe callbackify.
  //

  protected createGetter<T extends CharacteristicValue>(
    getter: Getter<T>,
    fallbackValue: T,
    suppressError = true,
  ): GetterCallback {
    return (callback) => {
      this.context.tesla
        .getVehicleData()
        .then(async (data) => callback(null, await getter(data)))
        .catch((error: Error) => {
          this.context.log.error(`createGetter caught error:`, error);
          this.context.log.error(
            suppressError ? `createGetter suppressing it` : `createGetter throwing it`,
          );
          return suppressError ? callback(null, fallbackValue) : callback(error);
        });
    };
  }

  protected createSetter<T extends CharacteristicValue>(
    setter: Setter<T>,
    fallbackValue: T,
    suppressError = true,
  ): SetterCallback {
    return (value, callback) => {
      setter(value as T)
        .then((writeResponse) => callback(null, writeResponse ?? undefined))
        .catch((error: Error) => {
          this.context.log.error(`createSetter caught error:`, error);
          this.context.log.error(
            suppressError ? `createSetter suppressing it` : `createSetter throwing it`,
          );
          return suppressError ? callback(null, fallbackValue) : callback(error);
        });
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
