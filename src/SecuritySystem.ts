import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { EnvySecurityPlatform } from './platform';

/**
* Platform Accessory
* An instance of this class is created for each accessory your platform registers
* Each accessory may expose multiple services of different service types.
*/
export class SecuritySystem {
  private service: Service;
  
  /**
  * These are just used to create a working example
  * You should implement your own code to track the state of your accessory
  */
  private currentState = -1;
  public targetState = -1;
  
  constructor(
    private readonly platform: EnvySecurityPlatform,
    private readonly accessory: PlatformAccessory,
    ) {
      
      // set accessory information
      this.accessory.getService(this.platform.Service.AccessoryInformation)?.
      setCharacteristic(this.platform.Characteristic.Manufacturer, 'Envy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Security System')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');
      
      // get the SecuritySystem service if it exists, otherwise create a new SecuritySystem service
      // you can create multiple services for each accessory
      this.service = this.accessory.getService(this.platform.Service.SecuritySystem) ||
      this.accessory.addService(this.platform.Service.SecuritySystem);
      
      // set the service name, this is what is displayed as the default name on the Home app
      // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
      this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
      
      // each service must implement at-minimum the "required characteristics" for the given service type
      // see https://developers.homebridge.io/#/service/SecuritySystem
      
      // create handlers for required characteristics
      this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .onGet(this.handleSecuritySystemCurrentStateGet.bind(this));
      
      this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .onGet(this.handleSecuritySystemTargetStateGet.bind(this))
      .onSet(this.handleSecuritySystemTargetStateSet.bind(this));
      
      let valid_values = this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState).props.validValues;
      this.accessory.context.device.log.info('valid_values', valid_values);
      
      this.accessory.context.device.log.info('stay_mode', this.accessory.context.device.stay_mode);
      if (this.accessory.context.device.stay_mode === undefined) {
        this.accessory.context.device.stay_mode === "ArmStay"
        this.accessory.context.device.log.info('stay_mode', this.accessory.context.device.stay_mode);
      }
      if (this.accessory.context.device.stay_mode === "Hidden") {
        valid_values = valid_values?.filter(value => value !== this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM)
      }
      
      this.accessory.context.device.log.info('away_mode', this.accessory.context.device.away_mode);
      if (this.accessory.context.device.away_mode === undefined) {
        this.accessory.context.device.away_mode = "ArmAway"
        this.accessory.context.device.log.info('away_mode', this.accessory.context.device.away_mode);
      }
      if (this.accessory.context.device.away_mode === "Hidden") {
        valid_values = valid_values?.filter(value => value !== this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM)
      }
      
      this.accessory.context.device.log.info('night_mode', this.accessory.context.device.night_mode);
      if (this.accessory.context.device.night_mode === undefined) {
        this.accessory.context.device.night_mode === "Hidden";
        this.accessory.context.device.log.info('night_mode', this.accessory.context.device.night_mode);
      }
      if (this.accessory.context.device.night_mode === "Hidden") {
        valid_values = valid_values?.filter(value => value !== this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM)
      }
      
      this.accessory.context.device.log.info('valid_values', valid_values);
      this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState).props.validValues = valid_values;
    }
    
    /**
    * Handle requests to get the current value of the "Security System Current State" characteristic
    */
    handleSecuritySystemCurrentStateGet() : number {
      //this.accessory.context.device.log.debug('Triggered handleSecuritySystemCurrentStateGet:', this.currentState);
      
      // set this to a valid value for SecuritySystemCurrentState
      const currentValue = this.currentState;
      if (currentValue === -1) {
        return this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
      }
      return currentValue;
    }
    
    
    /**
    * Handle requests to get the current value of the "Security System Target State" characteristic
    */
    handleSecuritySystemTargetStateGet() : number {
      //this.accessory.context.device.log.debug('Triggered handleSecuritySystemTargetStateGet:', this.targetState);
      
      // set this to a valid value for SecuritySystemTargetState
      const currentValue = this.targetState;
      if (currentValue === -1) {
        return this.platform.Characteristic.SecuritySystemTargetState.DISARM;
      }
      return currentValue;
    }
    
    /**
    * Handle requests to set the "Security System Target State" characteristic
    */
    handleSecuritySystemTargetStateSet(value: CharacteristicValue) : void {
      value = Number(value)
      //this.accessory.context.device.log.debug('Triggered handleSecuritySystemTargetStateSet:', value);
      //this.accessory.context.device.log.debug('Partition: ', this.getId());
      
      let new_mode = "Unknown";
      
      if (this.targetState !== value) {
        switch (value) {
          case this.platform.Characteristic.SecuritySystemCurrentState.DISARMED:
          new_mode = "Disarm";
          break;
          
          case this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM:
          new_mode = this.accessory.context.device.stay_mode;
          if (new_mode == undefined || new_mode === "Hidden") new_mode = "ArmStay";
          break;
          
          case this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM:
          new_mode = this.accessory.context.device.away_mode;
          if (new_mode == undefined || new_mode === "Hidden") new_mode = "ArmAway";
          break;
          
          case this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
          new_mode = this.accessory.context.device.night_mode;
          if (new_mode == undefined || new_mode === "Hidden") new_mode = "ArmNight";
          break;
        }
        if (new_mode !== "Unknown") this.platform.client.write('Security_system::SmartPin(PartitionNumber = ' + this.getId()
        + ', MacroName = ' + new_mode + ', User = , UserCode = ' + this.getCode() + ', ZoneNumber = )\n');
        this.targetState = value;
        if (new_mode !== "Unknown") this.platform.client.write('Security_system::Partition' + new_mode + '(Address = ' + this.getId() + ')\n');
        this.targetState = value;
      }
    }
    
    setSecuritySystemCurrentState(new_mode: string) : void {
      this.platform.log.info('Triggered setSecuritySystemCurrentState:', new_mode);
      
      let new_state = "Unknown";
      switch (new_mode)
      {
        case "Disarmed":
        new_state = "Disarmed";
        break;
        
        case "ArmedStay":
        new_state = "ArmedStay";
        if (this.accessory.context.device.stay_mode === "ArmStay") new_state = "ArmedStay";
        if (this.accessory.context.device.stay_mode === "ArmStayInstant") new_state = "ArmedStay";
        if (this.accessory.context.device.away_mode === "ArmStay") new_state = "ArmedAway";
        if (this.accessory.context.device.away_mode === "ArmStayInstant") new_state = "ArmedAway";
        if (this.accessory.context.device.night_mode === "ArmStay") new_state = "ArmedNight";
        if (this.accessory.context.device.night_mode === "ArmStayInstant") new_state = "ArmedNight";
        break;
        
        case "ArmedAway":
        new_state = "ArmedAway";
        if (this.accessory.context.device.stay_mode === "ArmAway") new_state = "ArmedStay";
        if (this.accessory.context.device.away_mode === "ArmAway") new_state = "ArmedAway";
        if (this.accessory.context.device.night_mode === "ArmAway") new_state = "ArmedNight";
        break;
        
        case "ArmedNight":
        new_state = "ArmedNight";
        if (this.accessory.context.device.stay_mode === "ArmNight") new_state = "ArmedStay";
        if (this.accessory.context.device.stay_mode === "ArmNightInstant") new_state = "ArmedStay";
        if (this.accessory.context.device.away_mode === "ArmNight") new_state = "ArmedAway";
        if (this.accessory.context.device.away_mode === "ArmNightInstant") new_state = "ArmedAway";
        if (this.accessory.context.device.night_mode === "ArmNight") new_state = "ArmedNight";
        if (this.accessory.context.device.night_mode === "ArmNightInstant") new_state = "ArmedNight";
        break;
      }
      
      this.platform.log.info('Triggered setSecuritySystemCurrentState:', new_state);

      let state = -1;
      switch (new_state) {
        case 'Disarmed':
        state = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
        break;
        
        case 'ArmedStay':
        state = this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM;
        break;
        
        case 'ArmedAway':
        state = this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
        break;
        
        case 'ArmedNight':
        state = this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
        break;
      }
      
      if (state !== -1) {
        this.setSecuritySystemCurrentStateNum(state);
      }
    }
    
    setSecuritySystemCurrentStateNum(state: number) : void {
      //this.platform.log.debug('Triggered setSecuritySystemCurrentState:', state);
      
      this.currentState = state;
      this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState).updateValue(state);
      if (this.targetState === -1) {
        this.targetState = state;
      }
    }
    
    setSecuritySystemTargetState(new_mode : string) : void {
      this.platform.log.info('Triggered setSecuritySystemTargetState:', new_mode);
      
      let new_state = "Unknown";
      switch (new_mode)
      {
        case "Disarmed":
        new_state = "Disarmed";
        break;
        
        case "ArmedStay":
        new_state = "ArmedStay";
        if (this.accessory.context.device.stay_mode === "ArmStay") new_state = "ArmedStay";
        if (this.accessory.context.device.stay_mode === "ArmStayInstant") new_state = "ArmedStay";
        if (this.accessory.context.device.away_mode === "ArmStay") new_state = "ArmedAway";
        if (this.accessory.context.device.away_mode === "ArmStayInstant") new_state = "ArmedAway";
        if (this.accessory.context.device.night_mode === "ArmStay") new_state = "ArmedNight";
        if (this.accessory.context.device.night_mode === "ArmStayInstant") new_state = "ArmedNight";
        break;
        
        case "ArmedAway":
        new_state = "ArmedAway";
        if (this.accessory.context.device.stay_mode === "ArmAway") new_state = "ArmedStay";
        if (this.accessory.context.device.away_mode === "ArmAway") new_state = "ArmedAway";
        if (this.accessory.context.device.night_mode === "ArmAway") new_state = "ArmedNight";
        break;
        
        case "ArmedNight":
        new_state = "ArmedNight";
        if (this.accessory.context.device.stay_mode === "ArmNight") new_state = "ArmedStay";
        if (this.accessory.context.device.stay_mode === "ArmNightInstant") new_state = "ArmedStay";
        if (this.accessory.context.device.away_mode === "ArmNight") new_state = "ArmedAway";
        if (this.accessory.context.device.away_mode === "ArmNightInstant") new_state = "ArmedAway";
        if (this.accessory.context.device.night_mode === "ArmNight") new_state = "ArmedNight";
        if (this.accessory.context.device.night_mode === "ArmNightInstant") new_state = "ArmedNight";
        break;
      }
      
      this.platform.log.info('Triggered setSecuritySystemTargetState:', new_state);

      let state = -1;
      switch (new_state) {
        case 'Disarmed':
        state = this.platform.Characteristic.SecuritySystemTargetState.DISARM;
        break;
        
        case 'ArmedStay':
        state = this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM;
        break;
        
        case 'ArmedAway':
        state = this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM;
        break;
        
        case 'ArmedNight':
        state = this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM;
        break;
      }
      
      if (state !== -1) {
        this.setSecuritySystemTargetStateNum(state);
      }
    }
    
    setSecuritySystemTargetStateNum(state : number) : void {
      //this.platform.log.debug('Triggered setSecuritySystemTargetState:', state);
      
      this.targetState = state;
      this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState).updateValue(state);
    }
    
    getId() : number {
      return this.accessory.context.device.id;
    }
    
    getCode() : string {
      return this.accessory.context.device.code;
    }
  }
  