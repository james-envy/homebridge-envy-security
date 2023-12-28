import { Service, PlatformAccessory } from 'homebridge';

import { EnvySecurityPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MotionSensor {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private motionDetected = false;

  constructor(
    private readonly platform: EnvySecurityPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)?.
      setCharacteristic(this.platform.Characteristic.Manufacturer, 'Envy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Motion Sensor')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the MotionSensor service if it exists, otherwise create a new MotionSensor service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.MotionSensor) ||
      this.accessory.addService(this.platform.Service.MotionSensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/MotionSensor

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.MotionDetected)
      .onGet(this.handleMotionDetectedGet.bind(this));

  }

  /**
   * Handle requests to get the current value of the "Motion Detected" characteristic
   */
  handleMotionDetectedGet() : boolean {
    //this.accessory.context.device.log.debug('Triggered handleMotionDetectedGet:', this.motionDetected);

    // set this to a valid value for MotionDetected
    const currentValue = this.motionDetected;

    return currentValue;
  }

  setMotionDetected(state: boolean) : void {
    //this.platform.log.debug('Triggered setMotionDetected:', state);
    this.motionDetected = state;
    this.service.getCharacteristic(this.platform.Characteristic.MotionDetected).setValue(state);
  }

  getId() : number {
    return this.accessory.context.device.id;
  }
}
