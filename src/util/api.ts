import { Logging } from "homebridge";
import { EventEmitter, ListenerMap } from "./events";
import { log } from "./log";
import { memoizeFn } from "./memoizeFn";
import { withLock } from "./mutex";
import "./teslajs";
import { MethodNames } from "./TJS";
import { getAccessToken } from "./token";
import { TeslaPluginConfig, Vehicle, VehicleData } from "./types";
import { wait } from "./wait";

const teslajs = require("teslajs");

export interface TeslaApiEvents extends ListenerMap {
  vehicleDataUpdated(data: VehicleData): void;
}

export class TeslaApi extends EventEmitter<TeslaApiEvents> {
  // Runtime state.
  private authToken: string | undefined;
  private authTokenExpires: number | undefined;
  private authTokenError: Error | undefined;

  constructor(
    private log: Logging,
    private config: TeslaPluginConfig,
  ) {
    super();
  }

  @memoizeFn({
    mark: "getOptions",
    timeout: 2_500,
    validateArgs: ({ ignoreCache } = {}) => !!ignoreCache,
  })
  @withLock("getOptions", 20_000)
  async getOptions({}: { ignoreCache?: boolean } = {}): Promise<TeslaJSOptions> {
    // First login if we don't have a token.
    const authToken = await this.getAuthToken();

    // Grab the string ID of your vehicle and the current state.
    const vehicle = await this.getVehicle();

    if (!vehicle)
      return {
        authToken,
        vehicleID: "",
        isOnline: false,
      };

    const { id_s: vehicleID, state } = vehicle;

    const options = { authToken, vehicleID, isOnline: state === "online" };

    this.log(`Tesla reports vehicle is ${state}.`);

    return options;
  }

  @memoizeFn({
    mark: "getAuthToken",
    timeout: 10_000,
  })
  @withLock("getAuthToken", 20_000)
  async getAuthToken(): Promise<string> {
    // Use a mutex to prevent multiple logins happening in parallel.
    try {
      const { config, authToken, authTokenExpires, authTokenError } = this;
      const { refreshToken } = config;

      if (authTokenError) {
        throw new Error("Authentication has previously failed; not retrying.");
      }

      // Return cached value if we have one, and if it hasn't expired.
      if (authToken && authTokenExpires && Date.now() < authTokenExpires) {
        return authToken;
      }

      this.log("Exchanging refresh token for an access token…");
      const china = this.config.china;
      const response = await getAccessToken(refreshToken, { china });

      if (response.error) {
        // Probably an invalid refresh token.
        let message = response.error;
        if (response.error === "server_error") {
          message += " (possibly an invalid refresh token)";
        }
        throw new Error(message);
      }

      // Save it in memory for future API calls.
      this.log("Got an access token.");
      this.authToken = response.access_token;
      this.authTokenExpires = response.expires_in * 1000 + Date.now() - 10000; // 10 second slop
      return response.access_token;
    } catch (error: any) {
      this.log("Error while getting an access token:", error.message);
      this.authTokenError = error;
      throw error;
    }
  }

  @memoizeFn({ mark: "getVehicle", timeout: 20_000 })
  async getVehicle() {
    try {
      const { vin } = this.config;

      // Only way to do this is to get ALL vehicles then filter out the one
      // we want.
      const authToken = await this.getAuthToken();
      const vehicles: Vehicle[] = await api("vehicles", { authToken });

      if (!vehicles) return;

      // Now figure out which vehicle matches your VIN.
      // `vehicles` is something like:
      // [ { id_s: '18488650400306554', vin: '5YJ3E1EA8JF006024', state: 'asleep', ... }, ... ]
      const vehicle = vehicles.find((v) => v.vin === vin);

      if (!vehicle) {
        this.log(
          "No vehicles were found matching the VIN ${vin} entered in your config.json. Available vehicles:",
        );
        for (const vehicle of vehicles) {
          this.log(`${vehicle.vin} [${vehicle.display_name}]`);
        }

        throw new Error(`Couldn't find vehicle with VIN ${vin}.`);
      }

      // this.log(
      //   `Using vehicle "${vehicle.display_name}" with state "${vehicle.state}"`,
      // );

      return vehicle;
    } catch (error) {
      log.error(`getVehicle catcher`, `Error while getting vehicle:`, error);
      throw error;
    }
  }

  wakeUp = async (options: TeslaJSOptions) => {
    // Is the car online already?
    if (options.isOnline) {
      this.log("Vehicle is online.");
      return;
    }

    this.log("Sending wakeup command…");

    // Send the command.
    await api("wakeUp", options);

    // Wait up to 30 seconds for the car to wake up.
    const start = Date.now();
    let waitTime = 2_000;
    const waitMinutes = this.config.waitMinutes || 1;

    while (Date.now() - start < waitMinutes * 60 * 1_000) {
      // Poll Tesla for the latest on this vehicle.
      const vehicle = await this.getVehicle();

      if (vehicle?.state === "online") {
        // Success!
        this.log("Vehicle is now online.");
        return;
      }

      this.log("Waiting for vehicle to wake up...");
      await wait(waitTime);

      // Use exponential backoff with a max wait of 10 seconds.
      waitTime = Math.min(waitTime * 2, 10_000);
    }

    throw new Error(`Vehicle did not wake up within ${waitMinutes} minutes.`);
  };

  @memoizeFn({
    mark: "getVehicleData",
    timeout: 2_500,
    validateArgs: ({ ignoreCache } = {}) => !!ignoreCache,
  })
  @withLock("getVehicleData", 20_000)
  async getVehicleData({
    ignoreCache,
  }: { ignoreCache?: boolean } = {}): Promise<VehicleData | null> {
    const options = await this.getOptions({ ignoreCache });

    if (!options.isOnline) {
      this.log(`Vehicle is not online;`);

      return null;
    }

    // Get the latest data from Tesla.
    this.log(`Getting latest vehicle data from Tesla${ignoreCache ? " (forced update)" : ""}…`);
    const data: VehicleData = await this.api("vehicleData", options);
    this.log("Vehicle data updated.");

    this.emit("vehicleDataUpdated", data);

    return data;
  }

  /**
   * Wakes up the vehicle,
   */
  public async wakeAndCommand(func: (options: TeslaJSOptions) => Promise<void>) {
    log.debug(`[Tesla]`, `Waking up and executing command`);
    const options: TeslaJSOptions = await this.getOptions({ ignoreCache: true });

    const background = async () => {
      try {
        if (!options.isOnline) {
          await this.wakeUp(options);
        }
      } catch (error) {
        this.log("Error before executing command:", error);
        return;
      }

      try {
        await func(options);
      } catch (error) {
        this.log("Error while executing command:", error);
      }

      try {
        // Refresh vehicle data since we're already connected and we just sent
        // a command.
        await this.getVehicleData({ ignoreCache: true });
      } catch (error) {
        this.log("Error after executing command:", error);
      }
    };

    // Only wait on the promise for a maximum of 5 seconds. If it takes much
    // longer, it ends up being a bad experience.
    await Promise.race([background(), wait(5_000)]).catch((error) => {
      this.log("Catcher: Error while executing command:", error);
    });
  }

  public async api(name: MethodNames, options: TeslaJSOptions, ...args: any[]): Promise<any> {
    try {
      return await teslajs[name + "Async"](options, ...args);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "Error response: 408") {
          log.info(`Tesla timed out communicating with the vehicle while executing "${name}".`);
        } else {
          log.info(`TeslaJS error while executing "${name}":`, error.message, error);
        }
      }

      throw error;
    }
  }
}

interface TeslaJSOptions {
  authToken: string;
  vehicleID: string;
  isOnline: boolean;
}

// teslajs.setLogLevel(tesla.API_LOG_ALL);

// Wrapper for TeslaJS functions that don't throw Error objects!
export default async function api(name: string, ...args: any[]): Promise<any> {
  const asyncMethodName = name + "Async";
  try {
    log.info("[TeslaJS]", `Calling ${asyncMethodName}`);
    return await teslajs[asyncMethodName](...args);
  } catch (errorOrString) {
    log.error("[TeslaJS]", `Error calling ${asyncMethodName}`, errorOrString);

    const error = errorOrString instanceof Error ? errorOrString : new Error(`${errorOrString}`);

    throw error;
  }
}
