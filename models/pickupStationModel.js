// backend/models/pickupStationModel.js
const mongoose = require("mongoose");

const pickupStationSchema = new mongoose.Schema({
  name: String,
  location: String,
  contactNumber: String,
  stationCode: { type: String, unique: true },
}, { timestamps: true });

module.exports = mongoose.model("PickupStation", pickupStationSchema);
