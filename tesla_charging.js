const teslaChargePortOpenId = 'tesla-motors.0.VIN.charge_state.charge_port_door_open';
const teslaSOCId = 'tesla-motors.0.VIN.charge_state.battery_level';
const teslaChargePowerId = 'tesla-motors.0.VIN.charge_state.charger_power';
const houseBatteryLevelId = 'modbus.0.inputRegisters.13022_Battery_level';
const houseSolarPowerId = 'modbus.0.inputRegisters.5016_Total_DC_Power';

const intervall = 10 * 1000;
var chargeAmps = 0;
var ampsHistory = [];
var loadHistory = [];
var ampsHistorySize = 0;
var chargePortOpen = getState(teslaChargePortOpenId).val;
var teslaSOC = getState(teslaSOCId).val;
var houseSOC = getState(houseBatteryLevelId).val;
var teslaChargePower = getState(teslaChargePowerId ).val;
var avgLoadDelta = 0;

const minHouseBattery = 80;
const teslaFullChargeBelowSOC = 10;
const minimumChargeAmps = 2;

console.log('chargePortOpen: ' + chargePortOpen)

const calcCharingSpeed = (pvWatts, houseSOC)  => {
    if (houseSOC > minHouseBattery) {
        var amps = Math.min(16, Math.trunc((pvWatts-500) / (3 * 230)));
        if (amps < minimumChargeAmps) amps = 0;
        return amps;
    } else
    {
        return 0;
    }
};

on('tesla-motors.0.LRW3E7EK7PC799735.charge_state.battery_level', function(obj) {
    teslaSOC = obj.state.val;
})

on(houseBatteryLevelId, function(obj) {
    houseSOC = obj.state.val
})

on(teslaChargePortOpenId, function (obj) {
    chargePortOpen = obj.state.val;
})

on(teslaChargePowerId, function(obj) {
    teslaChargePower = obj.state.val;
})

function avgArr(arr) {
    const sum = arr.reduce((a, b) => a + b, 0);
    return sum / arr.length;
}

on(houseSolarPowerId, function (obj) {
    if (chargePortOpen) {
        ampsHistory.push(obj.state.val);

        if (ampsHistory.length >= 20) {
            const avg = avgArr(ampsHistory);
            ampsHistory = [];

            var newAmps = teslaSOC < teslaFullChargeBelowSOC ? 16 : calcCharingSpeed(avg, houseSOC);
            if (newAmps == 0 && chargeAmps >= 2) {
                newAmps = chargeAmps - 1;
            }
            console.log('avg = ' + avg + '      newAmps:' + newAmps);
            console.log('DC-PV-Power ' + obj.state.val + '      Amps  ' + newAmps);
            if (newAmps == 0) {
                console.log('stopping charge, chargePower = '+teslaChargePower);
                if (teslaChargePower != 0) {
                    setState('tesla-motors.0.LRW3E7EK7PC799735.remote.charge_stop', false);
                    setState('tesla-motors.0.LRW3E7EK7PC799735.remote.set_charging_amps-charging_amps', 0);
                }
            } else {
                console.log('start charge');
                setState('tesla-motors.0.LRW3E7EK7PC799735.remote.set_charging_amps-charging_amps', newAmps);
                if (chargeAmps == 0) setState('tesla-motors.0.LRW3E7EK7PC799735.remote.charge_start', true);
            }
            chargeAmps = newAmps;
        }
    }
});
