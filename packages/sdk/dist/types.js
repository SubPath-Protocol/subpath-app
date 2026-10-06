"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionStatus = void 0;
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus[SubscriptionStatus["Active"] = 0] = "Active";
    SubscriptionStatus[SubscriptionStatus["Canceled"] = 1] = "Canceled";
    SubscriptionStatus[SubscriptionStatus["Paused"] = 2] = "Paused";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
