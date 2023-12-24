import { API, Categories, Logging, PlatformAccessory, PlatformConfig, Service } from "homebridge";
import { TeslaPluginService, TeslaPluginServiceContext } from "./services/TeslaPluginService";
import { TestService } from "./services/TestService";
import { TeslaApi } from "./util/api";
import { setLog } from "./util/log";
import { getConfigValue, TeslaPluginConfig } from "./util/types";

const pluginIdentifier = "@enixcoda/homebridge-tesla";
const platformName = "EnixCodaTesla";

export default function (api: API) {
  class TeslaPlatformPlugin {
    tesla: TeslaApi;
    context: TeslaPluginServiceContext;
    accessories: PlatformAccessory[] = [];

    constructor(
      log: Logging,
      platformConfig: PlatformConfig,
      public api: API,
    ) {
      setLog(log);
      const { platform, name, _bridge, ...restConfig } = platformConfig;
      const teslaPluginConfig = restConfig as TeslaPluginConfig;
      const tesla = new TeslaApi(log, teslaPluginConfig);

      this.tesla = tesla;
      this.context = { log, hap: api.hap, config: teslaPluginConfig, tesla };

      this.setup(teslaPluginConfig);
    }

    configureAccessory(accessory: PlatformAccessory) {
      this.accessories.push(accessory);
      this.context.log.info(`Configuring accessory ${accessory.displayName}`, accessory.UUID);

      this.logAccs();

      try {
        this.removeAccessory(accessory.displayName);
        this.context.log.info("Unregistered accessory", accessory.displayName);
      } catch (error) {
        this.context.log.error("Failed unregister accessory", accessory.displayName, `${error}`);
      }
    }

    private logAccs() {
      this.context.log.debug(this.accessories.map((a) => [a.displayName, a.UUID].join()).join());
    }

    private findExistingAccessory(name: string) {
      const uuid = api.hap.uuid.generate([platformName, name].join("/"));
      return this.accessories.find((accessory) => accessory.UUID === uuid);
    }

    private addAccessory(PluginService: typeof TeslaPluginService, category?: Categories) {
      const name = PluginService.serviceName;
      this.context.log.info(`Adding accessory ${name}`);
      if (!this.findExistingAccessory(PluginService.serviceName)) {
        this.context.log.info(`Existing accessory of ${name} not found, creating new`);
        // create a new accessory
        const uuid = api.hap.uuid.generate([platformName, name].join("/"));
        const accessory = new this.api.platformAccessory(name, uuid, category);
        const pluginService = new (PluginService as typeof DummyService)(this.context);
        accessory.addService(pluginService.service);
        if (accessory.services.includes(pluginService.service)) {
          this.context.log.info(`Service ${name} added to accessory`);
        }
        this.logAccs();
        // register the accessory
        this.api.registerPlatformAccessories(pluginIdentifier, platformName, [accessory]);
        this.accessories.push(accessory);
      }
    }

    private removeAccessory(serviceName: string) {
      this.context.log.info(`Removing accessory ${serviceName}`);
      // check the accessory was not restored from cache
      const accessory = this.findExistingAccessory(serviceName);
      if (accessory) {
        this.context.log.info(
          `Existing accessory of ${serviceName} ${accessory.UUID} found, removing`,
        );
        // unregister the accessory
        this.api.unregisterPlatformAccessories(pluginIdentifier, platformName, [accessory]);
        this.accessories.splice(this.accessories.indexOf(accessory), 1);
      }
    }

    private setService(
      Service: typeof TeslaPluginService,
      keys?: (keyof TeslaPluginConfig)[],
      category?: Categories,
    ) {
      if (!keys || keys.every((key) => getConfigValue(this.context.config, key))) {
        this.addAccessory(Service, category);
      } else {
        this.removeAccessory(Service.serviceName);
      }
    }

    private setup(config: TeslaPluginConfig) {
      const { log } = this.context;
      log.info("Setting up");
      this.api.on("didFinishLaunching", () => {
        log.info("Finished launching");
        const bindings = [
          // [ConnectionService],
          [TestService],
          // [BatteryService],
          // [VehicleLockService, ["vehicleLock"]],
          // [RearTrunkService, ["trunk"]],
          // [FrontTrunkService, ["frontTrunk"]],
          // [SteeringWheelHeaterService, ["steeringWheelHeater"]],
          // [ChargeLimitService, ["chargeLimit"]],
          // [ChargeLevelService, ["chargeLevel"]],
          // [ChargePortService, ["chargePort"]],
          // [ChargerService, ["charger"]],
          // [ChargingAmpsService, ["chargingAmps"]],
          // [DefrostService, ["defrost"]],
          // [SentryModeService, ["sentryMode"]],
          // [StarterService, ["starter"]],
          // [HomeLinkService, ["homeLink", "latitude", "longitude"]],
          // [
          //   getConfigValue(config, "climateSwitch") ? ClimateSwitchService : ClimateService,
          //   ["climate"],
          // ],
        ] as [typeof TeslaPluginService /* (keyof TeslaPluginConfig)[] */][];
        bindings.forEach(([Service /* keys */]) => this.setService(Service /* keys */));

        try {
          this.tesla.wakeAndCommand(async () => {
            try {
              await this.tesla.getVehicleData();
            } catch (error) {
              log.error("!!!!!!!!!!", error);
            }
          });
        } catch (error) {
          log.error("Failed to wake up on boot", error);
        }
      });
    }
  }

  api.registerPlatform(pluginIdentifier, platformName, TeslaPlatformPlugin);

  class DummyService extends TeslaPluginService {
    public service: Service;
    static serviceName = "DummyService";
    constructor(context: TeslaPluginServiceContext) {
      super(context);
      throw new Error("DummyService should not be instantiated");
    }
  }
}
