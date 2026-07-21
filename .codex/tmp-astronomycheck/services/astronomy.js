"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDarknessWindow = getDarknessWindow;
const SunCalc = __importStar(require("suncalc"));
const luxon_1 = require("luxon");
function getDarknessWindow(site, date) {
    const times = SunCalc.getTimes(date, site.coordinates.lat, site.coordinates.lng);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayTimes = SunCalc.getTimes(nextDay, site.coordinates.lat, site.coordinates.lng);
    const nightStart = times.night;
    const nightEnd = nextDayTimes.nightEnd;
    const hasTrueDarkness = nightStart != null && nightEnd != null;
    if (!hasTrueDarkness) {
        return { start: null, end: null, hasTrueDarkness: false };
    }
    return {
        start: luxon_1.DateTime.fromJSDate(nightStart).setZone(site.timezone),
        end: luxon_1.DateTime.fromJSDate(nightEnd).setZone(site.timezone),
        hasTrueDarkness: true
    };
    // @types/suncalc types these as Date, but suncalc returns null when the sun
    // never reaches -18° below horizon (no astronomical darkness — high latitudes
    // in summer). Guarding despite the optimistic types.
}
